import Shell from '@/components/Shell';
import ChangePassword from '@/components/ChangePassword';
import { needOfficer } from '@/lib/guard';

export default async function Account() {
  const s = await needOfficer(true);
  return (
    <Shell s={s}>
      <h2>My account</h2>
      <p className="note">{s.name} · user ID {s.sub}</p>
      {s.mustChange && <p className="attn">Your password was set by an administrator. Choose a new one to continue.</p>}
      <ChangePassword forced={!!s.mustChange} />
    </Shell>
  );
}
