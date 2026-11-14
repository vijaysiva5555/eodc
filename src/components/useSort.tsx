'use client';
import { useMemo, useState } from 'react';
import { sortBy, type Dir, type SortVal } from '@/lib/sort';

export type SortState = { col: number; dir: Dir } | null;

// Header cell with a sort button. aria-sort tells screen readers the current order.
export function SortHeader({ label, on, dir, onClick, align, style }: { label: React.ReactNode; on: boolean; dir: Dir; onClick: () => void; align?: 'r' | 'l'; style?: React.CSSProperties }) {
  return (
    <th className={align === 'r' ? 'r' : undefined} style={style} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="sorth" onClick={onClick} title="Sort">{label}<span className="sortind" aria-hidden>{on ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span></button>
    </th>
  );
}

// Sorts rows in the browser. Click a header once for ascending, again for descending.
// Until a header is clicked, rows keep the order the server sent.
export function useSort<T>(rows: T[], get: (row: T, col: number) => SortVal, initial: SortState = null) {
  const [s, setS] = useState<SortState>(initial);
  const sorted = useMemo(() => (s ? sortBy(rows, (r) => get(r, s.col), s.dir) : rows), [rows, s]); // eslint-disable-line react-hooks/exhaustive-deps
  const th = (col: number, label: React.ReactNode, opts: { align?: 'r' | 'l'; style?: React.CSSProperties } = {}) => (
    <SortHeader key={col} label={label} on={s?.col === col} dir={s?.dir ?? 'asc'} align={opts.align} style={opts.style}
      onClick={() => setS(s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })} />
  );
  return { sorted, th, sort: s, reset: () => setS(null) };
}
