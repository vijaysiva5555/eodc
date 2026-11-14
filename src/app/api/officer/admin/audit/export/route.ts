import { connectDB } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/session';
import { AuditLog } from '@/models/AuditLog';
import { xlsxResponse } from '@/lib/excel';
import { fmtTs } from '@/lib/format';
import { ACTION_LABEL, auditFilter, metaText } from '@/lib/audit';

// GET ?who=&role=&action=&from=&to=  (same filters as the activity log page). Super admin only.
export async function GET(req: Request) {
  if (!(await requireSuperAdmin())) return Response.json({ error: 'Super admin only' }, { status: 403 });
  const u = new URL(req.url).searchParams;
  await connectDB();
  const f = auditFilter({ who: u.get('who') || '', role: u.get('role') || '', action: u.get('action') || '', from: u.get('from') || '', to: u.get('to') || '' });
  const rows: any[] = await AuditLog.find(f).sort({ at: -1 }).limit(50000).lean();
  return xlsxResponse('activity-log', ['When (IST)', 'User ID / IEC', 'Name', 'Role', 'Activity', 'On', 'Details'],
    rows.map((r) => [fmtTs(r.at), r.actor || '', r.name || '', r.role || '', ACTION_LABEL[r.action] || r.action, r.target || '', metaText(r.meta)]));
}
