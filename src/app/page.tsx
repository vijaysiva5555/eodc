'use client';
import { useState } from 'react';

// Name of the customs station shown above the title, e.g. "Custom House, Surat" (set in .env.local)
const STATION = process.env.NEXT_PUBLIC_CUSTOMS_STATION || '';

export default function Login() {
  const [tab, setTab] = useState<'importer' | 'officer'>('importer');
  const [iec, setIec] = useState(''); const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState(''); const [password, setPassword] = useState('');
  const [sent, setSent] = useState<string | null>(null); const [err, setErr] = useState('');

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j;
  }
  const run = (fn: () => Promise<void>) => async (e: React.SyntheticEvent) => { e.preventDefault(); setErr(''); try { await fn(); } catch (x) { setErr((x as Error).message); } };

  return (
    <main className="auth">
     <div className="auth-frame">
      <div className="auth-brand">
        {STATION && <div className="station">{STATION}</div>}
        <h1>EODC Portal</h1>
        <p>Export Obligation Documentation Cell · EPCG and Advance Authorisation</p>
      </div>
      <div className="auth-form"><div style={{ width: '100%', maxWidth: 470 }}>
        <div className="tabs" role="tablist">
          {(['importer', 'officer'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setErr(''); }}>{t === 'importer' ? 'Importer' : 'Officer'}</button>
          ))}
        </div>
        {tab === 'importer' ? (
          <form onSubmit={run(async () => {
            if (!sent) { const j = await post('/api/auth/importer/request-otp', { iec }); setSent(j.message + (j.devOtp ? ` (dev OTP: ${j.devOtp})` : '')); }
            else { const j = await post('/api/auth/importer/verify', { iec, otp }); location.href = j.redirect; }
          })}>
            <label>IEC<input value={iec} onChange={(e) => setIec(e.target.value.toUpperCase())} maxLength={10} required readOnly={!!sent} /></label>
            {sent && <><p className="note">{sent}</p><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit OTP" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required autoFocus /></>}
            <button style={{ width: '100%', marginTop: 12 }}>{sent ? 'Verify and log in' : 'Send OTP'}</button>
            {sent && <div className="row end" style={{ marginTop: 8 }}>
              <button type="button" className="ghost small" onClick={() => { setSent(null); setOtp(''); setErr(''); }}>Change IEC</button>
              <button type="button" className="ghost small" onClick={run(async () => { const j = await post('/api/auth/importer/request-otp', { iec }); setOtp(''); setSent(j.message + (j.devOtp ? ` (dev OTP: ${j.devOtp})` : '')); })}>Resend OTP</button>
            </div>}
            <p className="note">First time? <a href="/register">Register</a> with your IEC and the e-Bond contact details.</p>
          </form>
        ) : (
          <form onSubmit={run(async () => { const j = await post('/api/auth/officer', { userId, password }); location.href = j.redirect; })}>
            <label>User ID<input value={userId} onChange={(e) => setUserId(e.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            <button style={{ width: '100%', marginTop: 12 }}>Log in</button>
          </form>
        )}
        {err && <p className="err" role="alert">{err}</p>}
      </div></div>
     </div>
    </main>
  );
}
