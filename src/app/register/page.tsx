'use client';
import { useState } from 'react';
import { send } from '@/components/api';

const STATION = process.env.NEXT_PUBLIC_CUSTOMS_STATION || '';

export default function Register() {
  const [v, setV] = useState({ iec: '', email: '', mobile: '' });
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  return (
    <main className="auth">
      <div className="auth-frame">
        <div className="auth-brand">
          {STATION && <div className="station">{STATION}</div>}
          <h1>EODC Portal</h1>
          <p>Export Obligation Documentation Cell · EPCG and Advance Authorisation</p>
        </div>
        <div className="auth-form">
          <form onSubmit={async (e) => { e.preventDefault(); setErr(''); setMsg(''); try { setMsg((await send('/api/auth/importer/register', JSON.stringify(v))).message); } catch (x) { setErr((x as Error).message); } }}>
            <h2>Register your IEC</h2>
            <p className="note">Use the e-mail and mobile number given on your e-Bond. Your licences appear once an officer has added them.</p>
            <label>IEC<input value={v.iec} maxLength={10} onChange={(e) => setV({ ...v, iec: e.target.value.toUpperCase() })} required /></label>
            <label>e-Bond e-mail<input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required /></label>
            <label>e-Bond mobile<input value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} required /></label>
            <button style={{ width: '100%', marginTop: 14 }}>Register</button>
            {msg && <p className="okmsg">{msg} <a href="/">Go to login</a></p>}
            {err && <p className="err" role="alert">{err}</p>}
            <p className="note">Already registered? <a href="/">Log in</a></p>
          </form>
        </div>
      </div>
    </main>
  );
}
