'use client';
import { useState } from 'react';
import { send } from './api';

export default function ChangePassword({ forced }: { forced: boolean }) {
  const [v, setV] = useState({ current: '', next: '', again: '' }); const [err, setErr] = useState(''); const [ok, setOk] = useState(false);
  return (
    <form className="card" style={{ maxWidth: 460 }} onSubmit={async (e) => {
      e.preventDefault(); setErr(''); setOk(false);
      if (v.next !== v.again) return setErr('The new passwords do not match');
      try { await send('/api/officer/account/password', JSON.stringify({ current: v.current, next: v.next })); setOk(true); if (forced) location.href = '/officer'; } catch (x) { setErr((x as Error).message); }
    }}>
      <label htmlFor="c">Current password</label><input id="c" type="password" autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} required />
      <label htmlFor="n">New password (10+ characters, letters and digits)</label><input id="n" type="password" autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} required />
      <label htmlFor="a">New password again</label><input id="a" type="password" autoComplete="new-password" value={v.again} onChange={(e) => setV({ ...v, again: e.target.value })} required />
      <div className="row"><button>Change password</button></div>
      {ok && <p className="okmsg" role="status">Password changed.</p>}{err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
