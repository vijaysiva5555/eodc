import Link from 'next/link';
import Shell from '@/components/Shell';
import { needOfficer } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { ChatMessage } from '@/models/ChatMessage';
import { alertCounts } from '@/lib/alerts';
import { inr } from '@/lib/format';

export default async function OfficerHome() {
  const s = await needOfficer();
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [agg, pending, today, alerts, chatUnread, chatToday]: any[] = await Promise.all([
    Licence.aggregate([{ $group: { _id: { scheme: '$scheme', status: '$status' }, n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { status: 'received' } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    Submission.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: '$type', n: { $sum: 1 } } }]),
    alertCounts(),
    ChatMessage.distinct('licenceNo', { from: 'importer', readAt: null }),
    ChatMessage.countDocuments({ from: 'importer', createdAt: { $gte: start } }),
  ]);
  const n = (sc: string, st: string) => agg.find((a: any) => a._id.scheme === sc && a._id.status === st)?.n ?? 0;
  const c = (arr: any[], t: string) => arr.find((x) => x._id === t)?.n ?? 0;
  return (
    <Shell s={s}>
      <div className="eyebrow">Licences by scheme</div>
      <div className="grid3">
        <Link className="tile" href="/officer/epcg"><h3>EPCG</h3><small>Active {inr(n('EPCG', 'active'))} · Closed {inr(n('EPCG', 'closed'))}</small><span className="go">Open active licences →</span></Link>
        <Link className="tile" href="/officer/deec"><h3>DEEC / AA</h3><small>Active {inr(n('DEEC', 'active'))} · Closed {inr(n('DEEC', 'closed'))}</small><span className="go">Open active licences →</span></Link>
        <Link className="tile clay" href="/officer/licence/new"><h3>+ Add new licence</h3><small>Goes to EPCG or DEEC/AA automatically</small></Link>
      </div>
      <div className="eyebrow">Submitted by parties · pending action</div>
      <div className="grid4" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
        {([['IC', 'ic', 'Installation certificates'], ['EODC', 'eodc', 'EODC'], ['DL', 'dl', 'DL replies'], ['MS', 'ms', 'Misc letters']] as const).map(([t, slug, label]) => (
          <Link key={t} href={`/officer/inbox/${slug}`} className="card stat" style={{ textDecoration: 'none' }}><b>{c(pending, t)}</b>{label}<br /><span>{c(today, t)} new today</span></Link>))}
        <Link href="/officer/messages" className="card stat" style={{ textDecoration: 'none' }}><b>{chatUnread.length}</b>Chat messages<br /><span>{chatToday} new today · {chatUnread.length === 1 ? 'licence' : 'licences'} unread</span></Link>
      </div>
      <div className="eyebrow">Alerts</div>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <Link className="alertpill" href="/officer/alerts?tab=ic"><b>{alerts.ic}</b> IC overdue</Link>
        <Link className="alertpill" href="/officer/alerts?tab=eo"><b>{alerts.eo}</b> EO expired, no EODC</Link>
        <Link className="alertpill" href="/officer/alerts?tab=bg"><b>{alerts.bg}</b> BG expiring in 30 days</Link>
      </div>
    </Shell>
  );
}
