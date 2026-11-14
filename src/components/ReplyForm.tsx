'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';

export default function ReplyForm({ ackNo }: { ackNo: string }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  if (!open) return <button onClick={() => setOpen(true)}>Reply and upload</button>;
  return (
    <form style={{ minWidth: 300 }} onSubmit={async (e) => {
      e.preventDefault(); setErr(''); if (!file) return setErr('Choose a PDF to upload'); setBusy(true);
      try { const fd = new FormData(); fd.set('replyTo', ackNo); fd.set('text', text); fd.set('file', file); await send('/api/importer/submissions', fd); router.refresh(); }
      catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
    }}>
      <label>Your reply<textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} required /></label>
      <label>Document (PDF, max 10 MB)<input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
      <div className="row"><button disabled={busy}>{busy ? 'Sending…' : 'Send reply'}</button><button type="button" className="ghost" onClick={() => setOpen(false)}>Cancel</button></div>
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
