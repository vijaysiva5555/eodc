import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { alertList, AlertTab } from '@/lib/alerts';
import { xlsxResponse } from '@/lib/excel';

export async function GET(req: Request) {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const tab = (new URL(req.url).searchParams.get('tab') || 'ic') as AlertTab;
  await connectDB();
  const { columns, rows } = await alertList(tab);
  return xlsxResponse(`alerts-${tab}`, columns, rows.map((r) => r.cells));
}
