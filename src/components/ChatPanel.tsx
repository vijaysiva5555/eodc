'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

type Msg = { id: string; from: 'importer' | 'officer'; mine: boolean; senderName: string; text: string; at: string; readAt: string | null; file: { url: string; name: string; size: number; mime: string } | null };
const POLL_MS = 8000;

const when = (d: string) => new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/ /g, '-').replace(',-', ', ');
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Conversation about one licence between the importer and the EODC cell. New messages appear every few seconds.
export default function ChatPanel({ licenceNo, role, title }: { licenceNo: string; role: 'importer' | 'officer'; title?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [canSend, setCanSend] = useState(true); const [loaded, setLoaded] = useState(false);
  const [seenUntil, setSeenUntil] = useState<string | null>(null); // the other side has read my messages up to this time
  const [text, setText] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const last = useRef<string | null>(null); const list = useRef<HTMLDivElement>(null); const fileInput = useRef<HTMLInputElement>(null);
  const atBottom = useRef(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat/${licenceNo}${last.current ? `?after=${encodeURIComponent(last.current)}` : ''}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setCanSend(j.canSend); setLoaded(true); setSeenUntil(j.seenUntil);
      if (j.messages.length) {
        last.current = j.messages[j.messages.length - 1].at;
        setMsgs((m) => { const seen = new Set(m.map((x) => x.id)); return [...m, ...j.messages.filter((x: Msg) => !seen.has(x.id))]; });
      }
    } catch { /* network blip: try again on the next poll */ }
  }, [licenceNo]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { // keep the newest message in view unless the user scrolled up to read older ones
    const el = list.current; if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault(); setErr('');
    if (!text.trim() && !file) return;
    if (file && file.size > 10 * 1024 * 1024) return setErr('Attachment is larger than 10 MB');
    setBusy(true);
    try {
      const fd = new FormData(); fd.set('text', text); if (file) fd.set('file', file);
      const r = await fetch(`/api/chat/${licenceNo}`, { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Message not sent. Try again.');
      atBottom.current = true;
      last.current = j.message.at;
      setMsgs((m) => [...m, j.message]); setText(''); setFile(null); if (fileInput.current) fileInput.current.value = '';
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  const other = role === 'importer' ? 'the EODC cell' : 'the importer';
  return (
    <section className="chat" aria-label={title || 'Messages'}>
      <div className="chat-head"><b>{title || 'Messages'}</b><span className="note">Licence {licenceNo} · visible to the importer and the EODC cell</span></div>
      <div className="chat-list" ref={list} role="log" aria-live="polite"
        onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {!loaded && <p className="note">Loading messages…</p>}
        {loaded && !msgs.length && <p className="note chat-empty">No messages yet. {canSend ? `Write to ${other} about this licence.` : ''}</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`chat-msg ${m.mine ? 'mine' : 'theirs'}`}>
            <div className="chat-meta">{m.mine ? 'You' : m.senderName}{!m.mine && m.from === 'officer' ? ' · EODC cell' : ''} · {when(m.at)}</div>
            <div className="chat-bubble">
              {m.text && <div className="chat-text">{m.text}</div>}
              {m.file && <a className="chat-file" href={m.file.url} target="_blank" rel="noreferrer">📎 {m.file.name} · {kb(m.file.size)}</a>}
            </div>
            {m.mine && <div className="chat-meta">{m.readAt || (seenUntil && +new Date(m.at) <= +new Date(seenUntil)) ? 'Seen' : 'Sent'}</div>}
          </div>))}
      </div>
      {canSend ? (
        <form className="chat-form" onSubmit={send}>
          <label htmlFor={`chat-${licenceNo}`} className="sr">Message</label>
          <textarea id={`chat-${licenceNo}`} rows={2} maxLength={4000} placeholder={`Write to ${other}…  (Ctrl+Enter to send)`} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
          <div className="row" style={{ marginTop: 8 }}>
            <label className="btn ghost small chat-attach">📎 Attach<input ref={fileInput} type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] || null)} hidden /></label>
            {file && <span className="note">{file.name} · {kb(file.size)} <button type="button" className="ghost small" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}>Remove</button></span>}
            <span style={{ flex: 1 }} />
            <button disabled={busy || (!text.trim() && !file)}>{busy ? 'Sending…' : 'Send'}</button>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
        </form>
      ) : <p className="note" style={{ padding: '10px 14px', margin: 0 }}>This licence is closed. The conversation is kept for the record and is read-only.</p>}
    </section>
  );
}
