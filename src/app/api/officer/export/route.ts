import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { xlsxResponse } from '@/lib/excel';
import { fmtDate, fmtDay, ageDays, STAGE_LABEL, SUB_STATUS, SUB_TYPE } from '@/lib/format';
import { nextDue } from '@/lib/rules';

// GET ?kind=licences&scheme=EPCG&status=active|closed&from=&to=   |   ?kind=inbox&type=IC&tab=received|action_over
export async function GET(req: Request) {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const u = new URL(req.url).searchParams;
  await connectDB();
  if (u.get('kind') === 'inbox') {
    const type = u.get('type') || 'IC';
    const st = u.get('tab') === 'action_over' ? { status: 'action_over' } : u.get('tab') === 'query_raised' ? { status: 'query_raised' } : { status: 'received' };
    const rows: any[] = await Submission.find({ type, ...st }).sort({ createdAt: -1 }).limit(5000).lean();
    return xlsxResponse(`${type}-${u.get('tab') || 'received'}`, ['Ack no.', 'Licence', 'Importer', 'Received', 'Age (d)', 'Assigned to', 'Status', 'Action by', 'Action on', 'e-Office ref'],
      rows.map((r) => [r.ackNo, r.licenceNo, r.partyName, fmtDay(r.createdAt), ageDays(r.createdAt), r.assignedTo || '', SUB_STATUS[r.status], r.action?.by || '', fmtDate(r.action?.on), r.action?.eOfficeRef || '']));
  }
  const scheme = u.get('scheme') === 'DEEC' ? 'DEEC' : 'EPCG';
  const status = u.get('status') === 'closed' ? 'closed' : 'active';
  const f: any = { scheme, status };
  if (status === 'closed' && (u.get('from') || u.get('to'))) f.closedOn = { ...(u.get('from') && { $gte: new Date(u.get('from')!) }), ...(u.get('to') && { $lte: new Date(u.get('to')! + 'T23:59:59Z') }) };
  const rows: any[] = await Licence.find(f).sort({ licenceNo: -1 }).limit(20000).lean();
  return status === 'closed'
    ? xlsxResponse(`${scheme}-closed`, ['Licence', 'Importer', 'IEC', 'EODC ack no.', 'Closed on', 'EODC action over by'], rows.map((l) => [l.licenceNo, l.partyName, l.iec, l.closingAckNo || '', fmtDate(l.closedOn), l.closedBy || '']))
    : xlsxResponse(`${scheme}-active`, ['Licence', 'Importer', 'IEC', 'Bond date', 'Stage', 'Next due'], rows.map((l) => [l.licenceNo, l.partyName, l.iec, fmtDate(l.bondDate), STAGE_LABEL[l.stage], nextDue(l)]));
}
