import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { alertCounts } from '@/lib/alerts';

export async function GET() {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [schemeAgg, pending, newToday, alerts] = await Promise.all([
    Licence.aggregate([{ $group: { _id: { scheme: '$scheme', status: '$status' }, n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { status: 'received' } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    alertCounts(),
  ]);
  return Response.json({ schemeAgg, pending, newToday, alerts });
}
