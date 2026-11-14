// Shared sorting rules for every list table (server pages and client components).
export type SortVal = string | number | null | undefined;
export type Dir = 'asc' | 'desc';

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const empty = (v: SortVal) => v === null || v === undefined || v === '' || v === '–' || (typeof v === 'number' && isNaN(v));

export function compare(a: SortVal, b: SortVal) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' });
}

// Stable sort; blank values always go last whatever the direction.
export function sortBy<T>(rows: T[], get: (r: T) => SortVal, dir: Dir): T[] {
  return rows.map((r, i) => ({ r, i, v: get(r) }))
    .sort((x, y) => {
      const ex = empty(x.v), ey = empty(y.v);
      if (ex || ey) return ex === ey ? x.i - y.i : ex ? 1 : -1;
      const c = compare(x.v, y.v);
      return (dir === 'asc' ? c : -c) || x.i - y.i;
    }).map((x) => x.r);
}

// Turns displayed text into a sortable value: amounts ("48,60,000", "₹ 3,32,000"), ages ("10 d"),
// dates ("12-Jan-2025", "12-Jan-2025, 18:40") and months ("Apr-2026"). Anything else sorts as text.
export function textValue(v: SortVal): SortVal {
  if (typeof v === 'number' || empty(v)) return v;
  const s = String(v).trim();
  if (/^-?(?:₹\s*)?[\d,]+(?:\.\d+)?(?:\s*d)?$/.test(s)) return Number(s.replace(/[^\d.-]/g, ''));
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
  if (m && MON.includes(m[2].toLowerCase())) return Date.UTC(+m[3], MON.indexOf(m[2].toLowerCase()), +m[1], +(m[4] || 0), +(m[5] || 0));
  m = s.match(/^([A-Za-z]{3})-(\d{4})$/);
  if (m && MON.includes(m[1].toLowerCase())) return Date.UTC(+m[2], MON.indexOf(m[1].toLowerCase()), 1);
  return s;
}

export const time = (d?: Date | string | null) => (d ? +new Date(d) : null);
export const parseDir = (d?: string): Dir => (d === 'asc' ? 'asc' : 'desc');
