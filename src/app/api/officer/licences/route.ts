import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { Importer } from '@/models/Importer';
import { audit } from '@/lib/audit';
import { moveFile, pdfInfo, readStored, errorResponse, UserError, safeRel } from '@/lib/files';
import { deriveDates, RULES } from '@/lib/rules';

// GET /api/officer/licences?scheme=EPCG&status=active&stage=ic_pending&q=sunrise&page=1
export async function GET(req: Request) {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = {};
  for (const k of ['scheme', 'status', 'stage']) if (u.get(k)) filter[k] = u.get(k);
  const q = u.get('q')?.replace(/[^\w\s/-]/g, '');
  if (q) { const r = new RegExp(q, 'i'); filter.$or = [{ licenceNo: r }, { iec: r }, { partyName: r }]; }
  const page = Math.max(1, Number(u.get('page') || 1)), size = 50;
  await connectDB();
  const [rows, total] = await Promise.all([
    Licence.find(filter).select('licenceNo scheme iec partyName bondDate stage status icDueOn eoEndsOn closedOn')
      .sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).lean(),
    Licence.countDocuments(filter),
  ]);
  return Response.json({ rows, total, page, size });
}

const Values = z.object({
  licenceNo: z.string().regex(/^\d{10}$/, 'Licence no. must be 10 digits'),
  scheme: z.enum(['EPCG', 'DEEC']),
  licenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  iec: z.string().regex(/^[A-Z0-9]{10}$/),
  partyName: z.string().min(2),
  dutySaved: z.coerce.number().positive(),
  issuingOffice: z.string().optional().default(''),
  bondNo: z.string().min(4), bondDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bondAmount: z.coerce.number().positive(), executedAt: z.string().optional().default(''),
  email: z.string().email(), mobile: z.string().regex(/^[6-9]\d{9}$/), address: z.string().optional().default(''),
  altEmail: z.string().trim().email().or(z.literal('')).optional(),
  bgNo: z.string().optional(), bgAmount: z.coerce.number().optional(), bgValidTill: z.string().optional(),
  bgBank: z.string().optional(), bgBranch: z.string().optional(),
  bgBankAddress: z.string().trim().max(400).optional(), bgBankEmail: z.string().trim().email().or(z.literal('')).optional(),
  eoEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // "Export Validity" printed on Advance Authorisations
});

export async function POST(req: Request) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const body = await req.json();
    const p = Values.safeParse(body.values);
    if (!p.success) return Response.json({ error: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
    const v = p.data;
    const token = String(body.token || '');
    if (!/^[a-f0-9]{16}$/.test(token)) throw new UserError('Upload session expired. Upload the PDFs again.');
    const tmp = { licence: body.paths?.licence, ebond: body.paths?.ebond, ebg: body.paths?.ebg || null };
    for (const k of ['licence', 'ebond']) if (!tmp[k as 'licence'] || !safeRel(tmp[k as 'licence']) || !tmp[k as 'licence'].startsWith(`tmp/${token}/`)) throw new UserError('Upload session expired. Upload the PDFs again.');
    if (v.bgNo && !(v.bgAmount && v.bgValidTill)) throw new UserError('BG needs an amount and a valid-till date');

    await connectDB();
    if (await Licence.exists({ licenceNo: v.licenceNo })) throw new UserError(`Licence ${v.licenceNo} already exists`, 409);

    const lDate = new Date(v.licenceDate), bDate = new Date(v.bondDate);
    const d = deriveDates(v.scheme, lDate, bDate);
    const dest = `licences/${v.licenceNo}`;
    const att: any[] = [];
    for (const [key, docType, name] of [['licence', 'DGFT licence', 'Licence'], ['ebond', 'e-Bond', 'eBond'], ['ebg', 'e-BG', 'eBG']] as const) {
      const rel = tmp[key]; if (!rel) continue;
      const to = `${dest}/${key}_${Date.now()}.pdf`;
      const info = await pdfInfo(await readStored(rel));
      await moveFile(rel, to);
      att.push({ fileName: `${name}_${key === 'licence' ? v.licenceNo : key === 'ebond' ? v.bondNo.replace(/\//g, '-') : v.bgNo || ''}.pdf`, docType, pages: info.pages, path: to, uploadedBy: s.name });
    }

    await Licence.create({
      licenceNo: v.licenceNo, scheme: v.scheme, licenceDate: lDate, iec: v.iec, partyName: v.partyName,
      issuingOffice: v.issuingOffice, dutySaved: v.dutySaved,
      eoMultiple: v.scheme === 'EPCG' ? RULES.eoMultiple : undefined,
      eoAmount: v.scheme === 'EPCG' ? v.dutySaved * RULES.eoMultiple : undefined,
      ...d, ...(v.eoEndsOn && { eoEndsOn: new Date(v.eoEndsOn) }), bondDate: bDate, stage: 'new', status: 'active',
      bonds: [{ bondNo: v.bondNo, bondDate: bDate, amount: v.bondAmount, executedAt: v.executedAt, status: 'Live' }],
      bgs: v.bgNo ? [{ bgNo: v.bgNo, bank: v.bgBank, branch: v.bgBranch, amount: v.bgAmount, validTill: new Date(v.bgValidTill!), linkedBond: v.bondNo, bankAddress: v.bgBankAddress, bankEmail: v.bgBankEmail }] : [],
      attachments: att,
    });
    // importer record comes from the e-Bond contact details; the importer then registers with the same details
    const altEmail = v.altEmail && v.altEmail.toLowerCase() !== v.email.toLowerCase() ? v.altEmail : undefined;
    await Importer.updateOne({ iec: v.iec }, { $setOnInsert: { iec: v.iec, name: v.partyName, email: v.email, mobile: v.mobile, address: v.address, registered: false, ...(altEmail && { altEmail }) } }, { upsert: true });
    // an importer already on record keeps its contact details; only a missing alternative e-mail is filled in
    if (altEmail) await Importer.updateOne({ iec: v.iec, altEmail: { $in: [null, ''] } }, { $set: { altEmail } });
    await audit(s, 'add_licence', v.licenceNo);
    return Response.json({ licenceNo: v.licenceNo, scheme: v.scheme }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
