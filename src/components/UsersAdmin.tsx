'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';
import { useSort } from './useSort';

type U = { userId: string; name: string; designation: string; role: string; active: boolean; lastLoginAt?: string; locked: boolean };
const DESIG = ['Superintendent', 'DA', 'Admin'];
const ROLE_LABEL: Record<string, string> = { superadmin: 'Super admin', admin: 'Admin', officer: 'Officer' };

// superadmin: may create and manage admins and officers. admin: officers only. Super admin rows are never editable here.
export default function UsersAdmin({ users, me, superadmin }: { users: U[]; me: string; superadmin: boolean }) {
  const [err, setErr] = useState(''); const [shown, setShown] = useState<{ userId: string; pw: string } | null>(null);
  const [form, setForm] = useState({ userId: '', name: '', designation: 'DA', role: 'officer' });
  const [edit, setEdit] = useState<string | null>(null); const [ed, setEd] = useState({ name: '', designation: 'DA', role: 'officer' });
  const router = useRouter();
  // sort values per column: User ID, Name, Designation, Access (by rank), Status, Last login
  const RANK: Record<string, number> = { superadmin: 0, admin: 1, officer: 2 };
  const { sorted, th } = useSort(users, (u, c) => [u.userId, u.name, u.designation, RANK[u.role] ?? 3, u.active ? (u.locked ? 'Locked' : 'Active') : 'Deactivated', u.lastLoginAt ? +new Date(u.lastLoginAt) : null][c]);
  const canManage = (u: U) => u.role !== 'superadmin' && (superadmin || u.role === 'officer');
  const patch = async (id: string, body: object) => { setErr(''); try { const j = await send(`/api/officer/admin/users/${id}`, JSON.stringify(body), 'PATCH'); if (j.tempPassword) setShown({ userId: id, pw: j.tempPassword }); setEdit(null); router.refresh(); } catch (x) { setErr((x as Error).message); } };
  const accessSelect = (value: string, onChange: (v: string) => void, id?: string) => (
    <select id={id} aria-label="Access" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="officer">Officer</option>{superadmin && <option value="admin">Admin (can manage officer accounts)</option>}
    </select>);
  return (
    <>
      {shown && <div className="success" role="status"><h3>Temporary password for {shown.userId}</h3><code style={{ fontSize: '1.2rem' }}>{shown.pw}</code>
        <p className="note">Shown once. Give it to the user; they must set a new password at first login.</p><button className="small ghost" onClick={() => setShown(null)}>Done</button></div>}
      <table className="grid" style={{ marginTop: 12 }}>
        <thead><tr>{th(0, 'User ID')}{th(1, 'Name')}{th(2, 'Designation')}{th(3, 'Access')}{th(4, 'Status')}{th(5, 'Last login')}<th>Actions</th></tr></thead>
        <tbody>{sorted.map((u) => (
          <tr key={u.userId} style={u.active ? undefined : { opacity: .6 }}>
            <td>{u.userId}{u.userId === me && ' (you)'}</td>
            {edit === u.userId ? <>
              <td><input aria-label="Name" value={ed.name} onChange={(e) => setEd({ ...ed, name: e.target.value })} /></td>
              <td><select aria-label="Designation" value={ed.designation} onChange={(e) => setEd({ ...ed, designation: e.target.value })}>{DESIG.map((d) => <option key={d}>{d}</option>)}</select></td>
              <td>{accessSelect(ed.role, (role) => setEd({ ...ed, role }))}</td>
              <td colSpan={2} /><td><div className="row" style={{ margin: 0 }}><button className="small" onClick={() => patch(u.userId, ed)}>Save</button><button className="small ghost" onClick={() => setEdit(null)}>Cancel</button></div></td></> : <>
              <td>{u.name}</td><td>{u.designation}</td><td>{ROLE_LABEL[u.role] || u.role}</td>
              <td className={u.active ? '' : 'warn'}>{u.active ? (u.locked ? 'Locked' : 'Active') : 'Deactivated'}</td>
              <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) : 'Never'}</td>
              <td>{canManage(u) ? <div className="row" style={{ margin: 0 }}>
                <button className="small ghost" onClick={() => { setEdit(u.userId); setEd({ name: u.name, designation: u.designation, role: u.role }); }}>Edit</button>
                <button className="small ghost" onClick={() => confirm(`Reset password for ${u.userId}?`) && patch(u.userId, { resetPassword: true })}>Reset password</button>
                {u.locked && <button className="small ghost" onClick={() => patch(u.userId, { unlock: true })}>Unlock</button>}
                {u.userId !== me && <button className="small ghost" onClick={() => patch(u.userId, { active: !u.active })}>{u.active ? 'Deactivate' : 'Activate'}</button>}</div>
                : <span className="note">{u.role === 'superadmin' ? 'Managed by script' : 'Super admin only'}</span>}</td></>}
          </tr>))}</tbody>
      </table>
      {err && <p className="err" role="alert">{err}</p>}
      <h3 style={{ marginTop: 24 }}>{superadmin ? 'Add admin or officer' : 'Add officer'}</h3>
      <form className="card" style={{ maxWidth: 520 }} onSubmit={async (e) => { e.preventDefault(); setErr(''); try { const j = await send('/api/officer/admin/users', JSON.stringify(form)); setShown({ userId: j.userId, pw: j.tempPassword }); setForm({ userId: '', name: '', designation: 'DA', role: 'officer' }); router.refresh(); } catch (x) { setErr((x as Error).message); } }}>
        <label htmlFor="nu">User ID</label><input id="nu" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value.toLowerCase() })} required />
        <label htmlFor="nn">Name</label><input id="nn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label htmlFor="nd">Designation</label><select id="nd" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>{DESIG.map((d) => <option key={d}>{d}</option>)}</select>
        <label htmlFor="nr">Access</label>{accessSelect(form.role, (role) => setForm({ ...form, role }), 'nr')}
        <div className="row"><button>Create and show temporary password</button></div>
      </form>
    </>
  );
}
