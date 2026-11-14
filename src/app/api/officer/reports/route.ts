import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { runReport, REPORTS } from '@/lib/reports';
import { xlsxResponse } from '@/lib/excel';

export async function GET(req: Request) {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const report = u.get('report') || 'registrations';
  if (!REPORTS.some((r) => r.key === report)) return Response.json({ error: 'Unknown report' }, { status: 400 });
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);
  const from = iso.test(u.get('from') || '') ? u.get('from')! : `${today.slice(0, 4)}-04-01`;
  const to = iso.test(u.get('to') || '') ? u.get('to')! : today;
  await connectDB();
  const r = await runReport({ report, scheme: u.get('scheme') === 'DEEC' ? 'DEEC' : 'EPCG', from, to, group: u.get('group') === 'year' ? 'year' : 'month' });
  if (u.get('format') === 'xlsx') return xlsxResponse(`report-${report}`, r.columns, [...r.rows, ...(r.total ? [r.total] : [])]);
  return Response.json(r);
}
