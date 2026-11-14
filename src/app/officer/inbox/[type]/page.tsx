import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import Tabs from '@/components/Tabs';
import InboxTable from '@/components/InboxTable';
import DataTable from '@/components/DataTable';
import { time } from '@/lib/sort';
import { needOfficer } from '@/lib/guard';
import { Submission } from '@/models/Submission';
import { Officer } from '@/models/Officer';
import { fmtDay, fmtDate, ageDays, inr, INBOX_SLUG, SUB_TYPE } from '@/lib/format';

export default async function Inbox({ params, searchParams }: { params: { type: string }; searchParams: { tab?: string } }) {
  const type = INBOX_SLUG[params.type]; if (!type) notFound();
  const s = await needOfficer();
  const tab = searchParams.tab === 'action_over' ? 'action_over' : searchParams.tab === 'query_raised' ? 'query_raised' : 'received';
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [nr, nq, na, today, officers, rows, open]: any[] = await Promise.all([
    Submission.countDocuments({ type, status: 'received' }), Submission.countDocuments({ type, status: 'query_raised' }), Submission.countDocuments({ type, status: 'action_over' }),
    Submission.countDocuments({ type, createdAt: { $gte: start } }), Officer.find({ active: true }).sort({ name: 1 }).lean(),
    Submission.find({ type, status: tab }).sort({ createdAt: tab === 'received' ? 1 : -1 }).limit(200).lean(),
    tab === 'received' ? Submission.find({ type, status: 'received' }).select('createdAt').lean() : Promise.resolve([]),
  ]);
  const oMap = Object.fromEntries(officers.map((o: any) => [o.userId, `${o.name}, ${o.designation}`]));
  const ages = open.map((x: any) => ageDays(x.createdAt));
  const href = (t: string) => `/officer/inbox/${params.type}?tab=${t}`;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Inbox</div>
      <h2>{SUB_TYPE[type]}s submitted by parties</h2>
      <div className="row end" style={{ marginTop: 0 }}>
        <Tabs items={[{ href: href('received'), label: `Received (${inr(nr)})`, active: tab === 'received' }, { href: href('query_raised'), label: `Query raised (${inr(nq)})`, active: tab === 'query_raised' }, { href: href('action_over'), label: `Action over (${inr(na)})`, active: tab === 'action_over' }]} />
        {tab === 'received' && <span className="note">{today} new today · 0–7 d: {ages.filter((a: number) => a <= 7).length} · 7–30 d: {ages.filter((a: number) => a > 7 && a <= 30).length} · over 30 d: {ages.filter((a: number) => a > 30).length}</span>}
      </div>
      {tab === 'action_over' ? (
        <DataTable
          columns={[{ label: 'Ack no.' }, { label: 'Licence' }, { label: 'Importer' }, { label: 'Received' }, { label: 'Action over' }, { label: 'By' }, { label: 'e-Office ref.' }]}
          rows={rows.map((r: any) => ({
            key: String(r._id),
            cells: [<Link key="a" href={`/officer/inbox/${params.type}/${r._id}`}>{r.ackNo}</Link>, <Link key="l" href={`/officer/licence/${r.licenceNo}`}>{r.licenceNo}</Link>, r.partyName, fmtDay(r.createdAt), fmtDate(r.action?.on), r.action?.by, r.action?.eOfficeRef],
            sort: [r.ackNo, r.licenceNo, r.partyName, time(r.createdAt), time(r.action?.on), r.action?.by, r.action?.eOfficeRef],
            cellClass: ['link', 'link'],
          }))}
          empty="Nothing here yet." />
      ) : (
        <InboxTable type={params.type} tab={tab} officers={officers.map((o: any) => ({ userId: o.userId, label: `${o.name}, ${o.designation}` }))}
          rows={rows.map((r: any) => ({ id: String(r._id), ackNo: r.ackNo, licenceNo: r.licenceNo, partyName: r.partyName, received: fmtDay(r.createdAt), receivedAt: +new Date(r.createdAt), age: ageDays(r.createdAt), assigned: oMap[r.assignedTo] || 'Unassigned' }))} />
      )}
      {tab === 'action_over' && <div className="row"><a className="btn ghost" href={`/api/officer/export?kind=inbox&type=${type}&tab=action_over`}>Export Excel</a></div>}
    </Shell>
  );
}
