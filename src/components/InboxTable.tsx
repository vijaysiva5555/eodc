'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';
import { useSort } from './useSort';

type Row = { id: string; ackNo: string; licenceNo: string; partyName: string; received: string; receivedAt: number; age: number; assigned: string };
export default function InboxTable({ rows, officers, type, tab }: { rows: Row[]; officers: { userId: string; label: string }[]; type: string; tab: string }) {
  const [sel, setSel] = useState<string[]>([]); const [to, setTo] = useState(officers[0]?.userId || '');
  const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const router = useRouter();
  // sort values per column: Ack no., Licence, Importer, Received, Age, Assigned to
  const { sorted, th } = useSort(rows, (r, c) => [r.ackNo, r.licenceNo, r.partyName, r.receivedAt, r.age, r.assigned === 'Unassigned' ? '' : r.assigned][c]);
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <>
      <table className="grid">
        <thead><tr><th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={!!rows.length && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} /></th>
          {th(0, 'Ack no.')}{th(1, 'Licence')}{th(2, 'Importer')}{th(3, 'Received')}{th(4, 'Age')}{th(5, 'Assigned to')}</tr></thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}><td><input type="checkbox" aria-label={`Select ${r.ackNo}`} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} /></td>
              <td className="link"><Link href={`/officer/inbox/${type}/${r.id}`}>{r.ackNo}</Link></td>
              <td className="link"><Link href={`/officer/licence/${r.licenceNo}`}>{r.licenceNo}</Link></td><td>{r.partyName}</td><td>{r.received}</td>
              <td className={r.age > 30 ? 'warn' : ''}>{r.age} d</td><td>{r.assigned}</td></tr>))}
          {!rows.length && <tr><td colSpan={7} className="note">Nothing waiting here.</td></tr>}
        </tbody>
      </table>
      <div className="row">
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Assign to" style={{ width: 200 }}>{officers.map((o) => <option key={o.userId} value={o.userId}>{o.label}</option>)}</select>
        <button className="ghost" disabled={!sel.length} onClick={async () => {
          setErr(''); setMsg('');
          try { const j = await send('/api/officer/submissions/assign', JSON.stringify({ ids: sel, assignTo: to })); setMsg(`${j.updated} assigned`); setSel([]); router.refresh(); } catch (x) { setErr((x as Error).message); }
        }}>Assign selected ({sel.length})</button>
        <a className="btn ghost" href={`/api/officer/export?kind=inbox&type=${type.toUpperCase()}&tab=${tab}`}>Export Excel</a>
        {msg && <span className="okmsg">{msg}</span>}{err && <span className="err">{err}</span>}
      </div>
    </>
  );
}
