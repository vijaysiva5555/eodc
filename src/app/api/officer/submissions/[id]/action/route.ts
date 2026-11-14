import { z } from 'zod';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { audit } from '@/lib/audit';
import { errorResponse, UserError } from '@/lib/files';
import { sendMail } from '@/lib/notify';

const Body = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('action_over'), remarks: z.string().min(1, 'Remarks are required'), eOfficeRef: z.string().min(1, 'e-Office file / letter no. is required') }),
  z.object({ decision: z.literal('raise_query'), queryText: z.string().min(3, 'Write the query'), replyBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Set a reply-by date') }),
]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const p = Body.safeParse(await req.json());
    if (!p.success) throw new UserError(p.error.issues.map((i) => i.message).join('; '));
    if (!mongoose.isValidObjectId(params.id)) throw new UserError('Item not found', 404);
    await connectDB();
    const sub: any = await Submission.findOne({ _id: params.id, status: 'received' });
    if (!sub) throw new UserError('Item not found, or it is not waiting for action', 404);

    if (p.data.decision === 'raise_query') {
      sub.status = 'query_raised';
      sub.query = { text: p.data.queryText, raisedOn: new Date(), replyBy: new Date(p.data.replyBy), raisedBy: s.name };
      await sub.save();
      if (sub.type === 'EODC') await Licence.updateOne({ licenceNo: sub.licenceNo }, { stage: 'query_raised' });
      await audit(s, 'raise_query', sub.ackNo);
      await sendMail(null, `Query on ${sub.ackNo}`, p.data.queryText, sub.iec);
      return Response.json({ ackNo: sub.ackNo, status: sub.status });
    }

    sub.status = 'action_over';
    sub.action = { by: s.name, on: new Date(), remarks: p.data.remarks, eOfficeRef: p.data.eOfficeRef };
    await sub.save();
    let closed = false;
    if (sub.type === 'IC') {
      await Licence.updateOne({ licenceNo: sub.licenceNo }, { stage: 'ic_received' });
    } else if (sub.type === 'EODC') {
      // EODC action over = EODC considered and licence cancelled; the licence closes on its own (no manual step)
      await Licence.updateOne({ licenceNo: sub.licenceNo }, {
        status: 'closed', stage: 'closed', closedOn: new Date(), closedBy: s.name, closingAckNo: sub.ackNo,
        $set: { 'bonds.$[].status': 'Cancelled' },
      });
      closed = true;
    }
    await audit(s, 'action_over', sub.ackNo, { closed });
    await sendMail(null, `Action over on ${sub.ackNo}`, closed ? 'Your licence has been closed.' : 'Your submission has been processed.', sub.iec);
    return Response.json({ ackNo: sub.ackNo, status: sub.status, licenceClosed: closed });
  } catch (e) { return errorResponse(e); }
}
