import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { Importer } from '@/models/Importer';
import { errorResponse, UserError } from '@/lib/files';
import { isoDate } from '@/lib/format';

const Body = z.object({
  licenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  eoEndsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  issuingOffice: z.string().optional(), partyName: z.string().min(2).optional(),
  dutySaved: z.coerce.number().positive().optional(),
  address: z.string().optional(), email: z.string().email().optional(), mobile: z.string().regex(/^\+?\d{10,13}$/).optional(),
  altEmail: z.string().trim().email().or(z.literal('')).optional(), // '' removes it
});

// Every correction is logged with user and time (licence.corrections)
export async function PATCH(req: Request, { params }: { params: { no: string } }) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new UserError(p.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    await connectDB();
    const lic: any = await Licence.findOne({ licenceNo: params.no });
    if (!lic) throw new UserError('Licence not found', 404);
    const imp: any = await Importer.findOne({ iec: lic.iec });
    const log: any[] = [];
    const set = (field: string, from: unknown, to: unknown, apply: () => void) => {
      if (to === undefined || String(from ?? '') === String(to)) return;
      log.push({ field, from: String(from ?? ''), to: String(to), by: s.name, at: new Date() }); apply();
    };
    const v = p.data;
    set('licenceDate', isoDate(lic.licenceDate), v.licenceDate, () => (lic.licenceDate = new Date(v.licenceDate!)));
    set('eoEndsOn', isoDate(lic.eoEndsOn), v.eoEndsOn, () => (lic.eoEndsOn = new Date(v.eoEndsOn!)));
    set('issuingOffice', lic.issuingOffice, v.issuingOffice, () => (lic.issuingOffice = v.issuingOffice));
    set('partyName', lic.partyName, v.partyName, () => (lic.partyName = v.partyName));
    set('dutySaved', lic.dutySaved, v.dutySaved, () => {
      lic.dutySaved = v.dutySaved; if (lic.eoMultiple) lic.eoAmount = v.dutySaved! * lic.eoMultiple;
    });
    if (imp) {
      set('address', imp.address, v.address, () => (imp.address = v.address));
      set('email', imp.email, v.email, () => (imp.email = v.email));
      set('mobile', imp.mobile, v.mobile, () => (imp.mobile = v.mobile));
      set('altEmail', imp.altEmail, v.altEmail, () => (imp.altEmail = v.altEmail || undefined));
      if (log.some((l) => ['address', 'email', 'mobile', 'altEmail'].includes(l.field))) await imp.save();
    }
    if (!log.length) return Response.json({ changed: 0 });
    lic.corrections.push(...log); await lic.save();
    await audit(s, 'correct_licence', params.no, Object.fromEntries(log.map((l) => [l.field, `${l.from || '–'} → ${l.to}`])));
    return Response.json({ changed: log.length });
  } catch (e) { return errorResponse(e); }
}
