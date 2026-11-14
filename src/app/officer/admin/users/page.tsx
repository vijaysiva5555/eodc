import Link from 'next/link';
import Shell from '@/components/Shell';
import UsersAdmin from '@/components/UsersAdmin';
import { needAdmin } from '@/lib/guard';
import { Officer } from '@/models/Officer';
import { plain } from '@/lib/format';

const ORDER: Record<string, number> = { superadmin: 0, admin: 1, officer: 2 };

export default async function Users() {
  const s = await needAdmin();
  const rows: any[] = await Officer.find().select('-passwordHash').sort({ name: 1 }).lean();
  const users = plain(rows).map((o: any) => ({ userId: o.userId, name: o.name, designation: o.designation, role: o.role || 'officer', active: o.active, lastLoginAt: o.lastLoginAt, locked: !!o.lockedUntil && new Date(o.lockedUntil) > new Date() }))
    .sort((a: any, b: any) => (ORDER[a.role] ?? 3) - (ORDER[b.role] ?? 3));
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Users</div>
      <div className="row end" style={{ marginTop: 0 }}><h2>User accounts</h2>{s.superadmin && <Link className="btn ghost small" href="/officer/admin/audit">Activity log</Link>}</div>
      <p className="note">{s.superadmin ? 'As super admin you can create and manage admin and officer accounts.' : 'As admin you can create and manage officer accounts. Admin accounts are managed by the super admin.'} Users are never deleted, because their names stay on the items they actioned. Deactivate an account to stop access immediately.</p>
      <UsersAdmin users={users} me={s.sub} superadmin={!!s.superadmin} />
    </Shell>
  );
}
