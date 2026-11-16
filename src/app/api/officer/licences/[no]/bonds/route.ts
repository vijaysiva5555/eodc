import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { readPdf, savePdf, pdfInfo, errorResponse, UserError } from '@/lib/files';
import { bgBankContact } from '@/lib/ocr';

const emailOrBlank = z.string().trim().email('enter a valid e-mail').or(z.literal(''));
const Bond = z.object({ kind: z.literal('bond'), bondNo: z.string().min(4), bondDate: z.string(), amount: z.coerce.number().positive(), executedAt: z.string().optional() });
const Bg = z.object({ kind: z.literal('bg'), bgNo: z.string().min(4), bank: z.string().min(2), branch: z.string().optional(), amount: z.coerce.number().positive(), validTill: z.string(), linkedBond: z.string().optional(),
  bankAddress: z.string().trim().max(400).default(''), bankEmail: emailOrBlank.default('') });
// Bank address / e-mail of a BG already on the licence (index = its position in the BG list)
const BgContact = z.object({ kind: z.literal('bgContact'), index: z.coerce.number().int().min(0), bgNo: z.string(), bankAddress: z.string().trim().max(400).default(''), bankEmail: emailOrBlank.default('') });

// Extra bonds or BGs are added to the same licence. An optional PDF is appended to Attachments.
export async function POST(req: Request, { params }: { params: { no: string } }) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const fd = await req.formData();
    const raw: Record<string, any> = Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
    const p = z.discriminatedUnion('kind', [Bond, Bg, BgContact]).safeParse(raw);
    if (!p.success) throw new UserError(p.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    await connectDB();
    const lic: any = await Licence.findOne({ licenceNo: params.no });
    if (!lic) throw new UserError('Licence not found', 404);
    const d = p.data;

    if (d.kind === 'bgContact') {
      const g = lic.bgs[d.index];
      if (!g || g.bgNo !== d.bgNo) throw new UserError('BG not found. Reload the page and try again.', 404);
      const log = ([['bankAddress', 'bank address'], ['bankEmail', 'bank email']] as const).filter(([k]) => String(g[k] ?? '') !== d[k])
        .map(([k, label]) => ({ field: `BG ${g.bgNo} ${label}`, from: String(g[k] ?? ''), to: d[k], by: s.name, at: new Date() }));
      if (!log.length) return Response.json({ changed: 0 });
      g.bankAddress = d.bankAddress || undefined; g.bankEmail = d.bankEmail || undefined;
      lic.corrections.push(...log); await lic.save();
      await audit(s, 'update_bg', params.no, { no: g.bgNo, bankAddress: d.bankAddress, bankEmail: d.bankEmail });
      return Response.json({ changed: log.length });
    }

    if (d.kind === 'bg' && d.linkedBond && !lic.bonds.some((b: any) => b.bondNo === d.linkedBond)) throw new UserError('Linked e-Bond must be one of this licence’s bonds');
    let attachment: any; let pdfText = '';
    const f = fd.get('file');
    if (f instanceof File && f.size > 0) {
      const buf = await readPdf(f, 'PDF');
      const rel = await savePdf(buf, `licences/${params.no}`, d.kind);
      const info = await pdfInfo(buf); pdfText = info.text;
      attachment = { fileName: f.name, docType: d.kind === 'bond' ? 'e-Bond' : 'e-BG', pages: info.pages, path: rel, uploadedBy: s.name };
    }
    if (d.kind === 'bond') lic.bonds.push({ bondNo: d.bondNo, bondDate: new Date(d.bondDate), amount: d.amount, executedAt: d.executedAt, status: 'Live' });
    else {
      // bank address / e-mail left blank are read from the attached e-BG, when it prints them
      const ocr = pdfText ? bgBankContact(pdfText) : { bankAddress: '', bankEmail: '' };
      lic.bgs.push({ bgNo: d.bgNo, bank: d.bank, branch: d.branch, amount: d.amount, validTill: new Date(d.validTill), linkedBond: d.linkedBond || lic.bonds[0]?.bondNo,
        bankAddress: d.bankAddress || ocr.bankAddress || undefined, bankEmail: d.bankEmail || ocr.bankEmail || undefined });
    }
    if (attachment) lic.attachments.push(attachment);
    await lic.save();
    await audit(s, d.kind === 'bond' ? 'add_bond' : 'add_bg', params.no, { no: d.kind === 'bond' ? d.bondNo : d.bgNo, amount: d.amount });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
