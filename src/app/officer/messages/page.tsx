import Link from 'next/link';
import Shell from '@/components/Shell';
import Tabs from '@/components/Tabs';
import DataTable from '@/components/DataTable';
import { needOfficer } from '@/lib/guard';
import { ChatMessage } from '@/models/ChatMessage';
import { Licence } from '@/models/Licence';
import { fmtTs } from '@/lib/format';
import { time } from '@/lib/sort';

// All licence conversations with parties, newest first. "Unread" = the party wrote and no officer has opened it yet.
export default async function Messages({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await needOfficer();
  const tab = searchParams.tab === 'all' ? 'all' : 'unread';
  const threads: any[] = await ChatMessage.aggregate([
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$licenceNo', last: { $last: '$$ROOT' }, count: { $sum: 1 },
      unread: { $sum: { $cond: [{ $and: [{ $eq: ['$from', 'importer'] }, { $eq: [{ $ifNull: ['$readAt', null] }, null] }] }, 1, 0] } } } },
    { $sort: { 'last.createdAt': -1 } },
  ]);
  const lics: any[] = await Licence.find({ licenceNo: { $in: threads.map((t) => t._id) } }).select('licenceNo scheme partyName status').lean();
  const lic = Object.fromEntries(lics.map((l) => [l.licenceNo, l]));
  const unreadThreads = threads.filter((t) => t.unread > 0);
  const rows = tab === 'unread' ? unreadThreads : threads;
  const snippet = (m: any) => `${m.from === 'importer' ? 'Party' : m.senderName}: ${m.text ? (m.text.length > 90 ? `${m.text.slice(0, 90)}…` : m.text) : `📎 ${m.file?.name || 'attachment'}`}`;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Messages</div>
      <h2>Messages from parties</h2>
      <Tabs items={[{ href: '/officer/messages?tab=unread', label: `Unread (${unreadThreads.length})`, active: tab === 'unread' }, { href: '/officer/messages?tab=all', label: `All conversations (${threads.length})`, active: tab === 'all' }]} />
      <DataTable
        columns={[{ label: 'Licence' }, { label: 'Scheme' }, { label: 'Importer' }, { label: 'Last message' }, { label: 'When' }, { label: 'Unread', align: 'r' }, { label: 'Messages', align: 'r' }]}
        rows={rows.map((t) => ({
          key: t._id,
          cells: [<Link key="l" href={`/officer/licence/${t._id}?tab=chat`}>{t._id}</Link>, lic[t._id]?.scheme, lic[t._id]?.partyName, snippet(t.last), fmtTs(t.last.createdAt),
            t.unread ? <span key="u" className="count" style={{ marginLeft: 0 }}>{t.unread}</span> : '–', t.count],
          sort: [t._id, lic[t._id]?.scheme, lic[t._id]?.partyName, snippet(t.last), time(t.last.createdAt), t.unread || null, t.count],
          cellClass: ['link'],
        }))}
        empty={tab === 'unread' ? 'No unread messages. Open a licence and use “Chat with party” to start a conversation.' : 'No conversations yet.'} />
      <p className="note">A message counts as read once any officer opens the licence’s chat. Parties are e-mailed when the EODC cell writes to them.</p>
    </Shell>
  );
}
