'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { send } from './api';
import { useSort } from './useSort';
import { textValue } from '@/lib/sort';

type Row = { licenceNo: string; cells: string[] };

export default function AlertsTable({ tab, columns, rows }: { tab: string; columns: string[]; rows: Row[] }) {
  const [sel, setSel] = useState<string[]>([]); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const router = useRouter();
  // stable keys (a licence can appear twice on the BG tab, once per BG), so selection survives re-sorting
  const keyed = useMemo(() => rows.map((r, i) => ({ ...r, k: `${r.licenceNo}#${i}` })), [rows]);
  const { sorted, th } = useSort(keyed, (r, c) => textValue(r.cells[c]));
  const licences = () => [...new Set(sel.map((k) => k.split('#')[0]))];
  async function act(action: 'reminder' | 'flag_scn') {
    setErr(''); setMsg('');
    try { const j = await send('/api/officer/alerts/action', JSON.stringify({ licenceNos: licences(), action })); setMsg(`${j.updated} licence${j.updated === 1 ? '' : 's'} updated`); setSel([]); router.refresh(); } catch (x) { setErr((x as Error).message); }
  }
  const num = (c: string) => /₹|Days/.test(c);
  return (
    <>
      <table className="grid">
        <thead><tr><th style={{ width: 32 }}><input type="checkbox" aria-label="Select all" checked={!!rows.length && sel.length === rows.length} onChange={(e) => setSel(e.target.checked ? keyed.map((r) => r.k) : [])} /></th>
          {columns.map((c, i) => th(i, c, { align: num(c) ? 'r' : undefined }))}</tr></thead>
        <tbody>{sorted.map((r) => <tr key={r.k}><td><input type="checkbox" aria-label={`Select ${r.licenceNo}`} checked={sel.includes(r.k)} onChange={() => setSel(sel.includes(r.k) ? sel.filter((x) => x !== r.k) : [...sel, r.k])} /></td>
          {r.cells.map((c, j) => <td key={j} className={num(columns[j]) ? 'r' : j === 0 ? 'link' : ''}>{j === 0 ? <Link href={`/officer/licence/${c}`}>{c}</Link> : c}</td>)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length + 1} className="note">No licences need attention here.</td></tr>}</tbody>
      </table>
      <div className="row">
        <button disabled={!sel.length} onClick={() => act('reminder')}>Send reminder notice</button>
        {(tab === 'eo' || tab === 'ic') && <button className="ghost" disabled={!sel.length} onClick={() => act('flag_scn')}>Flag for SCN</button>}
        <a className="btn ghost" href={`/api/officer/alerts/export?tab=${tab}`}>Export Excel</a>
        {msg && <span className="okmsg">{msg}</span>}{err && <span className="err">{err}</span>}
      </div>
    </>
  );
}
