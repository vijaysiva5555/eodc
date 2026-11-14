'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { send } from './api';

export default function ActionForm({ id, type, licenceNo, scheme, backHref }: { id: string; type: string; licenceNo: string; scheme: string; backHref: string }) {
  const [mode, setMode] = useState<'action_over' | 'raise_query'>('action_over');
  const [v, setV] = useState({ remarks: '', eOfficeRef: '', queryText: '', replyBy: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const router = useRouter();
  const closes = type === 'EODC' && mode === 'action_over';
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await send(`/api/officer/submissions/${id}/action`, JSON.stringify(mode === 'action_over' ? { decision: mode, remarks: v.remarks, eOfficeRef: v.eOfficeRef } : { decision: mode, queryText: v.queryText, replyBy: v.replyBy }));
      router.push(backHref); router.refresh();
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  const opt = (m: typeof mode, label: string) => <button type="button" className={mode === m ? '' : 'ghost'} onClick={() => setMode(m)} aria-pressed={mode === m} style={{ flex: 1 }}>{mode === m ? '● ' : '○ '}{label}</button>;
  return (
    <form onSubmit={go}>
      <div className="row" style={{ marginTop: 0 }}>{opt('action_over', 'Action over')}{opt('raise_query', 'Raise query')}</div>
      {mode === 'action_over' ? <>
        <label htmlFor="rem">Remarks</label><input id="rem" value={v.remarks} onChange={(e) => setV({ ...v, remarks: e.target.value })} required />
        <label htmlFor="eo">e-Office file / letter no.</label><input id="eo" value={v.eOfficeRef} onChange={(e) => setV({ ...v, eOfficeRef: e.target.value })} required />
      </> : <>
        <label htmlFor="q">Query to the importer</label><textarea id="q" rows={3} value={v.queryText} onChange={(e) => setV({ ...v, queryText: e.target.value })} required />
        <label htmlFor="rb">Reply by</label><input id="rb" type="date" value={v.replyBy} onChange={(e) => setV({ ...v, replyBy: e.target.value })} required />
      </>}
      {closes ? <div className="attn" style={{ marginTop: 14 }}>Confirming will <b>close licence {licenceNo}</b>. It moves from {scheme} Active to {scheme} Closed, and the importer will see it as Closed.
        <div className="row"><button className="clay" disabled={busy}>{busy ? 'Closing…' : 'Confirm and close'}</button><Link className="btn ghost" href={backHref}>Cancel</Link></div></div>
        : <div className="row"><button className="clay" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : mode === 'raise_query' ? 'Send query' : 'Confirm'}</button></div>}
      {!closes && <p className="note">{mode === 'raise_query' ? 'The importer sees the query on their home page and replies with a document.' : type === 'IC' ? 'Item moves to Action over; licence stage becomes IC received.' : 'Item moves to Action over.'}</p>}
      {err && <p className="err" role="alert">{err}</p>}
    </form>
  );
}
