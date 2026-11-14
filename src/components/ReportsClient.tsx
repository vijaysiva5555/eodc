'use client';
import { useEffect, useState } from 'react';
import { useSort } from './useSort';
import { textValue } from '@/lib/sort';

type Rep = { columns: string[]; rows: (string | number)[][]; total?: (string | number)[]; align?: ('l' | 'r')[] };

// Report result. Headers sort the rows; the Total row always stays last.
function ReportTable({ data }: { data: Rep }) {
  const { sorted, th } = useSort(data.rows, (r, c) => textValue(r[c]));
  const cls = (j: number) => (data.align?.[j] === 'r' ? 'r' : '');
  return (
    <table className="grid" style={{ marginTop: 12 }}>
      <thead><tr>{data.columns.map((c, i) => th(i, c, { align: data.align?.[i] === 'r' ? 'r' : undefined }))}</tr></thead>
      <tbody>{sorted.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cls(j)}>{c}</td>)}</tr>)}
        {!data.rows.length && <tr><td colSpan={data.columns.length} className="note">No data for this period.</td></tr>}
        {data.total && data.rows.length > 0 && <tr className="tot">{data.total.map((c, j) => <td key={j} className={cls(j)}>{c}</td>)}</tr>}</tbody>
    </table>
  );
}
export default function ReportsClient({ reports, from0, to0 }: { reports: { key: string; label: string; hasPeriod: boolean; hasGroup: boolean }[]; from0: string; to0: string }) {
  const [report, setReport] = useState(reports[0].key);
  const [q, setQ] = useState({ scheme: 'EPCG', from: from0, to: to0, group: 'month' });
  const [data, setData] = useState<Rep | null>(null); const [runNo, setRunNo] = useState(0); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const cur = reports.find((r) => r.key === report)!;
  const qs = (extra = '') => `/api/officer/reports?${new URLSearchParams({ report, ...q })}${extra}`;
  async function run() {
    setBusy(true); setErr('');
    try { const r = await fetch(qs()); const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); setRunNo((n) => n + 1); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  useEffect(() => { run(); /* eslint-disable-next-line */ }, [report]);
  return (
    <div className="split" style={{ gridTemplateColumns: '220px 1fr' }}>
      <nav className="actions" aria-label="Reports">{reports.map((r) => <button key={r.key} className={r.key === report ? '' : 'ghost'} style={{ textAlign: 'left', border: r.key === report ? undefined : 0 }} onClick={() => setReport(r.key)}>{r.label}</button>)}</nav>
      <div>
        <div className="row" style={{ marginTop: 0 }}>
          <select aria-label="Scheme" value={q.scheme} onChange={(e) => setQ({ ...q, scheme: e.target.value })} style={{ width: 110 }}><option>EPCG</option><option>DEEC</option></select>
          {cur.hasPeriod && <><input type="date" aria-label="From" value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} style={{ width: 150 }} /><span>to</span><input type="date" aria-label="To" value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} style={{ width: 150 }} /></>}
          {cur.hasGroup && <select aria-label="Group by" value={q.group} onChange={(e) => setQ({ ...q, group: e.target.value })} style={{ width: 120 }}><option value="month">By month</option><option value="year">By year</option></select>}
          <button className="clay" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run'}</button>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        {data && <>
          <ReportTable key={runNo} data={data} />
          <div className="row"><a className="btn ghost" href={qs('&format=xlsx')}>Export Excel</a></div></>}
      </div>
    </div>
  );
}
