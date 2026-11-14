import Link from 'next/link';
import Shell from '@/components/Shell';
import { needSuperAdmin } from '@/lib/guard';
import { AuditLog } from '@/models/AuditLog';
import { fmtTs, inr } from '@/lib/format';
import { ACTION_LABEL, auditFilter, metaText } from '@/lib/audit';
import SortTh from '@/components/SortLink';
import { parseDir, type Dir } from '@/lib/sort';

const PAGE = 100;
// sortable columns -> database fields (sorted in the database so the order covers every page)
const SORT: Record<string, string> = { at: 'at', who: 'name', role: 'role', action: 'action', on: 'target' };
const ROLES: [string, string][] = [['', 'All roles'], ['superadmin', 'Super admin'], ['admin', 'Admin'], ['officer', 'Officer'], ['importer', 'Importer'], ['system', 'System']];
const ROLE_LABEL = Object.fromEntries(ROLES.slice(1));

// Activity log: every login, change and action by importers, officers, admins and the super admin. Super admin only.
export default async function Audit({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const s = await needSuperAdmin();
  const q = { who: searchParams.who || '', role: searchParams.role || '', action: searchParams.action || '', from: searchParams.from || '', to: searchParams.to || '' };
  const page = Math.max(1, Number(searchParams.page || 1));
  const sort = SORT[searchParams.sort || ''] ? searchParams.sort! : 'at';
  const dir: Dir = searchParams.sort ? parseDir(searchParams.dir) : 'desc';
  const f = auditFilter(q);
  const [total, rows]: [number, any[]] = await Promise.all([AuditLog.countDocuments(f), AuditLog.find(f).sort({ [SORT[sort]]: dir === 'asc' ? 1 : -1, ...(sort === 'who' && { actor: dir === 'asc' ? 1 : -1 }), _id: -1 }).skip((page - 1) * PAGE).limit(PAGE).lean()]);
  const qs = (o: Record<string, string>) => `?${new URLSearchParams(Object.fromEntries(Object.entries({ ...q, ...(searchParams.sort ? { sort, dir } : {}), ...o }).filter(([, v]) => v)))}`;
  const T = (label: string, k?: string) => <SortTh label={label} k={k} sort={sort} dir={dir} href={(k2, d2) => `/officer/admin/audit${qs({ sort: k2, dir: d2, page: '' })}`} />;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › <Link href="/officer/admin/users">Users</Link> › Activity log</div>
      <div className="row end" style={{ marginTop: 0 }}><h2>Activity log</h2><span className="note">{inr(total)} {total === 1 ? 'activity' : 'activities'}</span></div>
      <form className="row" style={{ marginTop: 0, marginBottom: 14 }}>
        <input name="who" defaultValue={q.who} placeholder="User ID, name, IEC, licence or ack no." aria-label="Search" style={{ width: 280 }} />
        <select name="role" defaultValue={q.role} aria-label="Role" style={{ width: 140 }}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select name="action" defaultValue={q.action} aria-label="Activity" style={{ width: 230 }}><option value="">All activities</option>{Object.entries(ACTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input type="date" name="from" defaultValue={q.from} aria-label="From" style={{ width: 150 }} />
        <input type="date" name="to" defaultValue={q.to} aria-label="To" style={{ width: 150 }} />
        {searchParams.sort && <><input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} /></>}
        <button className="small">Filter</button>
        <Link className="btn ghost small" href="/officer/admin/audit">Clear</Link>
        <a className="btn ghost small" href={`/api/officer/admin/audit/export${qs({})}`}>Export Excel</a>
      </form>
      <table className="grid"><thead><tr>{T('When (IST)', 'at')}{T('Who', 'who')}{T('Role', 'role')}{T('Activity', 'action')}{T('On', 'on')}{T('Details')}</tr></thead>
        <tbody>{rows.map((r) => <tr key={String(r._id)}>
          <td style={{ whiteSpace: 'nowrap' }}>{fmtTs(r.at)}</td>
          <td>{r.name ? <>{r.name}<div className="note">{r.actor}</div></> : r.actor}</td>
          <td>{ROLE_LABEL[r.role] || r.role}</td>
          <td className={/failed|locked/.test(r.action) ? 'warn' : ''}>{ACTION_LABEL[r.action] || r.action}</td>
          <td>{r.target || ''}</td>
          <td className="note">{metaText(r.meta)}</td></tr>)}
          {!rows.length && <tr><td colSpan={6} className="note">No activity matches.</td></tr>}</tbody></table>
      <div className="row end"><span className="note">Logins (including failed ones), licence and document actions, uploads, corrections, assignments, and user and password changes by importers, officers, admins and the super admin.</span>
        <span className="row" style={{ margin: 0 }}>{page > 1 && <Link className="btn ghost small" href={qs({ page: String(page - 1) })}>Previous</Link>}{page * PAGE < total && <Link className="btn ghost small" href={qs({ page: String(page + 1) })}>Next</Link>}</span></div>
    </Shell>
  );
}
