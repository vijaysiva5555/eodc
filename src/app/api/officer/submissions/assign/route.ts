import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Submission } from '@/models/Submission';
import { Officer } from '@/models/Officer';
import { errorResponse, UserError } from '@/lib/files';

export async function POST(req: Request) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const p = z.object({ ids: z.array(z.string()).min(1, 'Select at least one item'), assignTo: z.string().min(1) }).safeParse(await req.json());
    if (!p.success) throw new UserError(p.error.issues[0].message);
    await connectDB();
    const o: any = await Officer.findOne({ userId: p.data.assignTo, active: true });
    if (!o) throw new UserError('Officer not found', 404);
    const r = await Submission.updateMany({ _id: { $in: p.data.ids }, status: { $ne: 'action_over' } }, { assignedTo: o.userId });
    await audit(s, 'assign', undefined, { to: o.userId, items: r.modifiedCount });
    return Response.json({ updated: r.modifiedCount });
  } catch (e) { return errorResponse(e); }
}
