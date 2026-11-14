import Link from 'next/link';
import Shell from '@/components/Shell';
import { needImporter } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { ChatMessage } from '@/models/ChatMessage';
import { fmtDate } from '@/lib/format';

export default async function ImporterHome() {
  const s = await needImporter();
  const [agg, ics, queries, chats]: any[] = await Promise.all([
    Licence.aggregate([{ $match: { iec: s.iec } }, { $group: { _id: { scheme: '$scheme', status: '$status' }, n: { $sum: 1 } } }]),
    Licence.find({ iec: s.iec, status: 'active', scheme: 'EPCG', stage: { $in: ['new', 'ic_pending'] }, icDueOn: { $exists: true } }).sort({ icDueOn: 1 }).lean(),
    Submission.find({ iec: s.iec, status: 'query_raised' }).lean(),
    ChatMessage.aggregate([{ $match: { iec: s.iec, from: 'officer', readAt: null } }, { $group: { _id: '$licenceNo', n: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
  ]);
  const n = (sc: string, st: string) => agg.find((a: any) => a._id.scheme === sc && a._id.status === st)?.n ?? 0;
  const chatLic: any[] = chats.length ? await Licence.find({ iec: s.iec, licenceNo: { $in: chats.map((c: any) => c._id) } }).select('licenceNo scheme').lean() : [];
  const qLic: any[] = queries.length ? await Licence.find({ iec: s.iec, licenceNo: { $in: queries.map((q: any) => q.licenceNo) } }).select('licenceNo scheme').lean() : [];
  const schemeOf = (no: string) => qLic.find((l) => l.licenceNo === no)?.scheme ?? '';
  const QTYPE: Record<string, string> = { IC: 'installation certificate', EODC: 'EODC', DL: 'DL reply', MS: 'document' };
  const items: { text: string; href: string }[] = [
    ...ics.map((l: any) => ({ text: `Installation certificate due by ${fmtDate(l.icDueOn)} · EPCG ${l.licenceNo}`, href: `/importer/licence/${l.licenceNo}/submit/ic` })),
    ...chats.map((c: any) => ({ text: `${c.n === 1 ? 'New message' : `${c.n} new messages`} from the EODC cell · ${chatLic.find((l) => l.licenceNo === c._id)?.scheme ?? ''} ${c._id}`, href: `/importer/licence/${c._id}#chat` })),
    ...queries.map((q: any) => ({ text: `Query raised on your ${QTYPE[q.type] || q.type} · ${schemeOf(q.licenceNo)} ${q.licenceNo} · reply by ${fmtDate(q.query?.replyBy)}`, href: '/importer/submissions' })),
  ];
  return (
    <Shell s={s}>
      <h2>Welcome, {s.name}</h2>
      <div className="grid2">
        <Link className="tile" href="/importer/epcg"><h3>EPCG</h3><small>Active {n('EPCG', 'active')} · Closed {n('EPCG', 'closed')}</small><span className="go">Open →</span></Link>
        <Link className="tile" href="/importer/deec"><h3>DEEC / Advance Authorisation</h3><small>Active {n('DEEC', 'active')} · Closed {n('DEEC', 'closed')}</small><span className="go">Open →</span></Link>
      </div>
      {items.length > 0 && <div className="attn"><b>Needs your attention ({items.length})</b>{items.map((t, i) => <div key={i}><Link href={t.href}>{t.text}</Link></div>)}</div>}
      <p><Link href="/importer/submissions">My submissions and queries →</Link></p>
    </Shell>
  );
}
