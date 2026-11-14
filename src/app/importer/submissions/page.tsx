import Link from 'next/link';
import Shell from '@/components/Shell';
import ReplyForm from '@/components/ReplyForm';
import DataTable from '@/components/DataTable';
import { time } from '@/lib/sort';
import { needImporter } from '@/lib/guard';
import { Submission } from '@/models/Submission';
import { fmtDay, fmtDate, SUB_STATUS, SUB_TYPE } from '@/lib/format';

export default async function MySubmissions() {
  const s = await needImporter();
  const rows: any[] = await Submission.find({ iec: s.iec }).sort({ createdAt: -1 }).lean();
  const open = rows.filter((r) => r.status === 'query_raised');
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/importer">Home</Link> › My submissions</div>
      <DataTable
        columns={[{ label: 'Ack no.' }, { label: 'Licence' }, { label: 'Type' }, { label: 'Submitted' }, { label: 'Status' }]}
        rows={rows.map((r) => ({
          key: r.ackNo,
          cells: [r.ackNo, r.licenceNo, SUB_TYPE[r.type], fmtDay(r.createdAt), `${SUB_STATUS[r.status]}${r.status === 'action_over' && r.action?.on ? ` · ${fmtDate(r.action.on)}` : ''}`],
          sort: [r.ackNo, r.licenceNo, SUB_TYPE[r.type], time(r.createdAt), SUB_STATUS[r.status]],
          cellClass: ['', '', '', '', r.status === 'query_raised' ? 'warn' : ''],
        }))}
        empty="Nothing submitted yet. Open a licence and choose a document to submit." />
      {open.map((q) => (
        <div className="attn row end" key={q.ackNo} style={{ alignItems: 'flex-start' }}>
          <div><b>Query on {SUB_TYPE[q.type]} · {q.licenceNo} · raised {fmtDate(q.query?.raisedOn)}</b>
            <div>{q.query?.text} Reply by {fmtDate(q.query?.replyBy)}.</div></div>
          <ReplyForm ackNo={q.ackNo} />
        </div>))}
    </Shell>
  );
}
