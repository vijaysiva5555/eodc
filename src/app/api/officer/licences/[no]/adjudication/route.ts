import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { audit } from '@/lib/audit';
import { readPdf, savePdf, errorResponse, UserError } from '@/lib/files';

const Date_ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Scn = z.object({ step: z.literal('scn'), no: z.string().min(1), date: Date_, dutyAmount: z.coerce.number().positive(), interest: z.string().optional() });
const Ph = z.object({ step: z.literal('ph'), phDate: Date_, hearingDate: Date_, outcome: z.enum(['scheduled', 'attended', 'adjourned', 'not attended']) });
const Oio = z.object({ step: z.literal('oio'), no: z.string().min(1), date: Date_, outcome: z.enum(['duty confirmed', 'partly confirmed', 'dropped']) });

export async function POST(req: Request, { params }: { params: { no: string } }) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const fd = await req.formData();
    const p = z.discriminatedUnion('step', [Scn, Ph, Oio]).safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
    if (!p.success) throw new UserError(p.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    await connectDB();
    const lic: any = await Licence.findOne({ licenceNo: params.no });
    if (!lic) throw new UserError('Licence not found', 404);
    const adj = lic.adjudication || (lic.adjudication = {});
    const d = p.data;
    const file = fd.get('file');
    const upload = async (required: boolean) => {
      if (!required && !(file instanceof File && file.size > 0)) return undefined;
      return savePdf(await readPdf(file, 'PDF'), `licences/${params.no}`, d.step);
    };

    if (adj.concluded) throw new UserError('Adjudication is already concluded');
    if (d.step === 'scn') {
      if (adj.scn?.no) throw new UserError('A show cause notice is already recorded');
      adj.scn = { no: d.no, date: new Date(d.date), dutyAmount: d.dutyAmount, interest: !!d.interest, path: await upload(true), by: s.name };
      lic.stage = 'adjudication'; lic.scnFlagged = false;
    } else if (d.step === 'ph') {
      if (!adj.scn?.no) throw new UserError('Record the show cause notice first');
      adj.ph.push({ phDate: new Date(d.phDate), hearingDate: new Date(d.hearingDate), outcome: d.outcome, path: await upload(false), by: s.name });
    } else {
      if (!adj.scn?.no || !adj.ph?.length) throw new UserError('Record the show cause notice and at least one PH notice first');
      adj.oio = { no: d.no, date: new Date(d.date), outcome: d.outcome, path: await upload(true), by: s.name };
      adj.concluded = true; // uploading the OIO ends the proceedings
    }
    lic.markModified('adjudication');
    await lic.save();
    await audit(s, `adjudication_${d.step}`, params.no);
    return Response.json({ ok: true, concluded: !!adj.concluded }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
