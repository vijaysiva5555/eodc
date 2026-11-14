'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';

export type PField = { name: string; label: string; type?: 'text' | 'date' | 'number' | 'select' | 'textarea'; options?: string[]; required?: boolean; defaultValue?: string };

// Generic "+ Upload / + Add" button that opens an inline multipart form, posts it and refreshes the page.
export default function FormPanel({ url, label, title, fields, hidden = {}, file, fileRequired = true, disabled, hint, small = true }:
  { url: string; label: string; title?: string; fields: PField[]; hidden?: Record<string, string>; file?: string; fileRequired?: boolean; disabled?: boolean; hint?: string; small?: boolean }) {
  const [open, setOpen] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  if (!open) return <button className={small ? 'small' : ''} disabled={disabled} title={hint} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form style={{ width: '100%', textAlign: 'left', marginTop: 8 }} onSubmit={async (e) => {
      e.preventDefault(); setErr(''); setBusy(true);
      try {
        const fd = new FormData(e.currentTarget); Object.entries(hidden).forEach(([k, v]) => fd.set(k, v));
        await send(url, fd); setOpen(false); router.refresh();
      } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }}>
      {title && <b>{title}</b>}
      {fields.map((f) => (
        <div key={f.name}><label htmlFor={`${url}-${f.name}`}>{f.label}</label>
          {f.type === 'select' ? <select id={`${url}-${f.name}`} name={f.name} defaultValue={f.defaultValue}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
            : f.type === 'textarea' ? <textarea id={`${url}-${f.name}`} name={f.name} rows={2} required={f.required} />
            : <input id={`${url}-${f.name}`} name={f.name} type={f.type || 'text'} required={f.required} defaultValue={f.defaultValue} />}</div>))}
      {file && <><label htmlFor={`${url}-file`}>{file} (PDF, max 10 MB)</label><input id={`${url}-file`} name="file" type="file" accept="application/pdf" required={fileRequired} /></>}
      <div className="row"><button disabled={busy}>{busy ? 'Saving…' : 'Save'}</button><button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
