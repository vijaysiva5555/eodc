'use client';
import { useState } from 'react';
import Link from 'next/link';
import { send } from './api';

type Field = { key: string; label: string; type?: 'text' | 'date' | 'select' | 'textarea'; options?: string[]; required?: boolean };
const CONFIG: Record<string, { title: string; fields: Field[]; fileLabel: string }> = {
  ic: { title: 'Installation certificate', fileLabel: 'Upload certificate', fields: [
    { key: 'certifiedBy', label: 'Certified by', type: 'select', options: ['Chartered Engineer', 'Chartered Accountant', 'Cost Accountant'], required: true },
    { key: 'certDate', label: 'Certificate date', type: 'date', required: true }] },
  eodc: { title: 'EODC', fileLabel: 'Upload EODC (include the bond cancellation request in the same PDF)', fields: [
    { key: 'eodcNo', label: 'EODC no. (DGFT)', required: true }, { key: 'eodcDate', label: 'EODC date', type: 'date', required: true }] },
  dl: { title: 'Reply to deficiency letter', fileLabel: 'Upload reply', fields: [
    { key: 'dlRef', label: 'Deficiency letter no.', required: true }, { key: 'dlDate', label: 'Deficiency letter date', type: 'date' },
    { key: 'remarks', label: 'Remarks', type: 'textarea' }] },
  ms: { title: 'Other document', fileLabel: 'Upload document', fields: [
    { key: 'subject', label: 'Subject', required: true }, { key: 'remarks', label: 'Remarks', type: 'textarea' }] },
};
const TYPE = { ic: 'IC', eodc: 'EODC', dl: 'DL', ms: 'MS' } as const;

export default function SubmitForm({ licenceNo, scheme, type, email }: { licenceNo: string; scheme: string; type: keyof typeof TYPE; email: string }) {
  const c = CONFIG[type];
  const [v, setV] = useState<Record<string, string>>(type === 'ic' ? { certifiedBy: 'Chartered Engineer' } : {});
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ ackNo: string; receivedAt: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Choose a PDF to upload');
    if (file.type !== 'application/pdf') return setErr('Only PDF files are accepted');
    if (file.size > 10 * 1024 * 1024) return setErr('File is larger than 10 MB');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('type', TYPE[type]); fd.set('licenceNo', licenceNo); fd.set('details', JSON.stringify(v)); fd.set('file', file);
      setDone(await send('/api/importer/submissions', fd));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="split">
      <form onSubmit={submit}>
        <div className="hdr"><h2>{scheme} {licenceNo} · {c.title}</h2></div>
        {c.fields.map((f) => (
          <div key={f.key}><label htmlFor={f.key}>{f.label}</label>
            {f.type === 'select' ? <select id={f.key} value={v[f.key] || ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
              : f.type === 'textarea' ? <textarea id={f.key} rows={3} value={v[f.key] || ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
              : <input id={f.key} type={f.type || 'text'} required={f.required} value={v[f.key] || ''} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />}
          </div>))}
        <label htmlFor="file">{c.fileLabel} (PDF, max 10 MB)</label>
        <div className="dash"><input id="file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          {file && <p className="note" style={{ margin: '8px 0 0' }}>{file.name} · {(file.size / 1048576).toFixed(1)} MB</p>}</div>
        <div className="row"><button disabled={busy || !!done}>{busy ? 'Submitting…' : 'Submit'}</button><Link className="btn ghost" href={`/importer/licence/${licenceNo}`}>{done ? 'Back to licence' : 'Cancel'}</Link></div>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
      {done && <div className="success" role="status"><h3>Submitted successfully</h3>
        <div>Acknowledgement no.<br /><b>{done.ackNo}</b></div>
        <p>{new Date(done.receivedAt).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} · status: Received</p>
        <p className="note">A copy is emailed to {email}</p>
        <Link href="/importer/submissions">View my submissions →</Link></div>}
    </div>
  );
}
