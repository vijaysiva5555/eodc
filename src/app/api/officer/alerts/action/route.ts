import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { audit } from '@/lib/audit';
import { errorResponse, UserError } from '@/lib/files';
import { sendMail } from '@/lib/notify';

export async function POST(req: Request) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const p = z.object({ licenceNos: z.array(z.string()).min(1, 'Select at least one licence'), action: z.enum(['reminder', 'flag_scn']) }).safeParse(await req.json());
    if (!p.success) throw new UserError(p.error.issues[0].message);
    await connectDB();
    const lics: any[] = await Licence.find({ licenceNo: { $in: p.data.licenceNos }, status: 'active' });
    for (const l of lics) {
      if (p.data.action === 'reminder') {
        l.letters.push({ kind: 'notice', title: 'Reminder notice', letterNo: '', date: new Date(), uploadedBy: s.name, system: true });
        await l.save();
        await sendMail(null, `Reminder notice: licence ${l.licenceNo}`, 'Please submit the pending document against this licence.', l.iec);
      } else if (!l.adjudication?.scn?.no) {
        l.scnFlagged = true; await l.save();
      }
      await audit(s, `alert_${p.data.action}`, l.licenceNo);
    }
    return Response.json({ updated: lics.length });
  } catch (e) { return errorResponse(e); }
}
