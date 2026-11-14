import Link from 'next/link';
import type { Dir } from '@/lib/sort';

// Header cell for paged lists: sorting happens on the server (?sort=&dir=) so the order covers every page.
export default function SortTh({ label, k, sort, dir, href, align }: { label: string; k?: string; sort: string; dir: Dir; href: (sort: string, dir: Dir) => string; align?: 'r' }) {
  if (!k) return <th className={align === 'r' ? 'r' : undefined}>{label}</th>;
  const on = sort === k;
  const next: Dir = on && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th className={align === 'r' ? 'r' : undefined} aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <Link className="sorth" href={href(k, next)} scroll={false} title="Sort">{label}<span className="sortind" aria-hidden>{on ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span></Link>
    </th>
  );
}
