'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';

type Init = Record<'licenceDate' | 'eoEndsOn' | 'issuingOffice' | 'partyName' | 'dutySaved' | 'address' | 'email' | 'altEmail' | 'mobile', string>;
const LABELS: [keyof Init, string, string][] = [
  ['partyName', 'Party', 'text'], ['licenceDate', 'Licence date', 'date'], ['issuingOffice', 'Issuing office', 'text'], ['dutySaved', 'Duty saved (₹)', 'number'],
  ['eoEndsOn', 'EO period ends', 'date'], ['address', 'Address', 'text'], ['email', 'Email', 'email'], ['altEmail', 'Alternative email (optional)', 'email'], ['mobile', 'Mobile', 'text'],
];

// Corrections to OCR values. Only changed fields are sent; the server logs each with user and time.
export default function LicenceEdit({ licenceNo, init }: { licenceNo: string; init: Init }) {
  const [open, setOpen] = useState(false); const [v, setV] = useState(init); const [err, setErr] = useState(''); const router = useRouter();
  if (!open) return <button className="ghost small" onClick={() => setOpen(true)}>Correct details</button>;
  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setErr('');
      const changes = Object.fromEntries(Object.entries(v).filter(([k, x]) => x !== init[k as keyof Init]));
      if (!Object.keys(changes).length) return setOpen(false);
      try { await send(`/api/officer/licences/${licenceNo}`, JSON.stringify(changes), 'PATCH'); setOpen(false); router.refresh(); } catch (x) { setErr((x as Error).message); }
    }}>
      {LABELS.map(([k, l, t]) => <div key={k}><label htmlFor={k}>{l}</label><input id={k} type={t} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>)}
      <div className="row"><button>Save corrections</button><button type="button" className="ghost" onClick={() => { setV(init); setOpen(false); }}>Cancel</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
