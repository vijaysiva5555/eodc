import Link from 'next/link';
import LogoutButton from './LogoutButton';
import type { Session } from '@/lib/session';
import { ChatMessage } from '@/models/ChatMessage';

// Unread licence-chat messages for whoever is logged in: officers see what parties wrote, importers what the EODC cell wrote.
async function unreadCount(s: Session) {
  try {
    return await ChatMessage.countDocuments(s.role === 'officer' ? { from: 'importer', readAt: null } : { iec: s.iec, from: 'officer', readAt: null });
  } catch { return 0; }
}

export default async function Shell({ s, children }: { s: Session; children: React.ReactNode }) {
  const officer = s.role === 'officer';
  const unread = await unreadCount(s);
  const messages = <Link href={officer ? '/officer/messages' : '/importer/messages'} style={{ marginLeft: 0 }}>Messages{unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}</Link>;
  return (
    <div className={`page ${s.role}`}>
      <div className="frame">
      <div className="bar">
        <b><Link href={officer ? '/officer' : '/importer'} style={{ margin: 0, color: '#fff' }}>EODC Portal</Link> <span>· {!officer ? 'Importer' : s.superadmin ? 'Super admin' : 'Officer'}</span></b>
        <nav>
          {officer ? <><Link href="/officer">Home</Link><span style={{ marginLeft: 6 }}>· {s.name}</span> · {messages} · <Link href="/officer/reports" style={{ marginLeft: 0 }}>Reports</Link>{s.admin && <> · <Link href="/officer/admin/users" style={{ marginLeft: 0 }}>Users</Link></>}{s.superadmin && <> · <Link href="/officer/admin/audit" style={{ marginLeft: 0 }}>Activity log</Link></>} · <Link href="/officer/account" style={{ marginLeft: 0 }}>Account</Link> · <LogoutButton /></>
            : <><span>{s.name} · IEC {s.iec} · </span>{messages} · <LogoutButton /></>}
        </nav>
      </div>
      <main>{children}</main>
      </div>
    </div>
  );
}
