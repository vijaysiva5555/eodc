import Link from 'next/link';
import LogoutButton from './LogoutButton';
import type { Session } from '@/lib/session';

export default function Shell({ s, children }: { s: Session; children: React.ReactNode }) {
  const officer = s.role === 'officer';
  return (
    <div className={`page ${s.role}`}>
      <div className="frame">
      <div className="bar">
        <b><Link href={officer ? '/officer' : '/importer'} style={{ margin: 0, color: '#fff' }}>EODC Portal</Link> <span>· {!officer ? 'Importer' : s.superadmin ? 'Super admin' : 'Officer'}</span></b>
        <nav>
          {officer ? <><Link href="/officer">Home</Link><span style={{ marginLeft: 6 }}>· {s.name}</span> · <Link href="/officer/reports" style={{ marginLeft: 0 }}>Reports</Link>{s.admin && <> · <Link href="/officer/admin/users" style={{ marginLeft: 0 }}>Users</Link></>}{s.superadmin && <> · <Link href="/officer/admin/audit" style={{ marginLeft: 0 }}>Activity log</Link></>} ·<Link href="/officer/account" style={{ marginLeft: 0 }}>Account</Link> · <LogoutButton /></>
            : <><span>{s.name} · IEC {s.iec} · </span><LogoutButton /></>}
        </nav>
      </div>
      <main>{children}</main>
      </div>
    </div>
  );
}
