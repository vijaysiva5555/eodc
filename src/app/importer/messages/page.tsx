import Link from 'next/link';
import Shell from '@/components/Shell';
import DataTable from '@/components/DataTable';
import { needImporter } from '@/lib/guard';
import { ChatMessage } from '@/models/ChatMessage';
import { Licence } from '@/models/Licence';
import { fmtTs } from '@/lib/format';
import { time } from '@/lib/sort';

// The importer's conversations with the EODC cell, one per licence. To start one, open a licence and write a message.
export default async function MyMessages() {
  const s = await needImporter();
  const threads: any[] = await ChatMessage.aggregate([
    { $match: { iec: s.iec } }, { $sort: { createdAt: 1 } },
    { $group: { _id: '$licenceNo', last: { $last: '$$ROOT' }, count: { $sum: 1 },
      unread: { $sum: { $cond: [{ $and: [{ $eq: ['$from', 'officer'] }, { $eq: [{ $ifNull: ['$readAt', null] }, null] }] }, 1, 0] } } } },
    { $sort: { 'last.createdAt': -1 } },
  ]);
  const lics: any[] = await Licence.find({ iec: s.iec, licenceNo: { $in: threads.map((t) => t._id) } }).select('licenceNo scheme status').lean();
  const lic = Object.fromEntries(lics.map((l) => [l.licenceNo, l]));
  const snippet = (m: any) => `${m.from === 'importer' ? 'You' : 'EODC cell'}: ${m.text ? (m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text) : `📎 ${m.file?.name || 'attachment'}`}`;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/importer">Home</Link> › Messages</div>
      <h2>Messages with the EODC cell</h2>
      <DataTable
        columns={[{ label: 'Licence' }, { label: 'Scheme' }, { label: 'Last message' }, { label: 'When' }, { label: 'Unread', align: 'r' }]}
        rows={threads.map((t) => ({
          key: t._id,
          cells: [<Link key="l" href={`/importer/licence/${t._id}#chat`}>{t._id}</Link>, lic[t._id]?.scheme, snippet(t.last), fmtTs(t.last.createdAt), t.unread ? <span key="u" className="count" style={{ marginLeft: 0 }}>{t.unread}</span> : '–'],
          sort: [t._id, lic[t._id]?.scheme, snippet(t.last), time(t.last.createdAt), t.unread || null],
          cellClass: ['link'],
        }))}
        empty="No messages yet." />
      <p className="note">To ask the EODC cell about a licence, open it from <Link href="/importer/epcg">EPCG</Link> or <Link href="/importer/deec">DEEC</Link> and write in the Messages box.</p>
    </Shell>
  );
}
