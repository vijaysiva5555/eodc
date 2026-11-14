'use client';
import { useSort } from './useSort';
import type { SortVal } from '@/lib/sort';

export type DTCol = { label: string; align?: 'r'; sortable?: boolean };
export type DTRow = { key: string; cells: React.ReactNode[]; sort: SortVal[]; className?: string; cellClass?: (string | undefined)[] };

// List table whose headers sort the rows in the browser. Used by server pages that load the whole list:
// they pass the rendered cells plus a plain sort value per cell (number for amounts and dates, text otherwise).
export default function DataTable({ columns, rows, empty, foot, style }: { columns: DTCol[]; rows: DTRow[]; empty?: React.ReactNode; foot?: React.ReactNode; style?: React.CSSProperties }) {
  const { sorted, th } = useSort(rows, (r, c) => r.sort[c]);
  return (
    <table className="grid" style={style}>
      <thead><tr>{columns.map((c, i) => (c.sortable === false
        ? <th key={i} className={c.align === 'r' ? 'r' : undefined}>{c.label}</th>
        : th(i, c.label, { align: c.align })))}</tr></thead>
      <tbody>
        {sorted.map((r) => <tr key={r.key} className={r.className}>{r.cells.map((cell, j) =>
          <td key={j} className={[columns[j]?.align === 'r' ? 'r' : '', r.cellClass?.[j] || ''].join(' ').trim() || undefined}>{cell}</td>)}</tr>)}
        {!rows.length && empty && <tr><td colSpan={columns.length} className="note">{empty}</td></tr>}
        {foot}
      </tbody>
    </table>
  );
}
