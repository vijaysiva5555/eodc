import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import Tabs from '@/components/Tabs';
import { needOfficer } from '@/lib/guard';
import { Licence, STAGES } from '@/models/Licence';
import SortTh from '@/components/SortLink';
import { parseDir, type Dir } from '@/lib/sort';
import { refreshStages, nextDue } from '@/lib/rules';
import { fmtDate, inr, isoDate, STAGE_LABEL, SCHEME_SLUG } from '@/lib/format';

const PAGE = 50;
// Sortable columns -> sort key computed in the database, so the order covers every page, not just the one shown
const now = () => new Date();
const KEYS: Record<string, () => unknown> = {
  licence: () => '$licenceNo', importer: () => '$partyName', iec: () => '$iec', bond: () => '$bondDate',
  stage: () => ({ $indexOfArray: [STAGES, '$stage'] }), // workflow order, not A-Z
  // the same date the "Next due" column shows: IC due, next BG expiry or EO block, whichever is first
  due: () => ({ $cond: [{ $in: ['$stage', ['eodc_received', 'query_raised', 'defaulter', 'adjudication']] }, null, { $min: [
    { $cond: [{ $in: ['$stage', ['new', 'ic_pending']] }, '$icDueOn', null] },
    { $min: { $filter: { input: { $ifNull: ['$bgs.validTill', []] }, as: 'd', cond: { $gte: ['$$d', now()] } } } },
    { $cond: [{ $gte: ['$eoBlockDueOn', now()] }, '$eoBlockDueOn', null] }] }] }),
  ack: () => '$closingAckNo', closed: () => '$closedOn', by: () => '$closedBy', added: () => '$createdAt',
};
export default async function OfficerList({ params, searchParams }: { params: { scheme: string }; searchParams: Record<string, string | undefined> }) {
  const scheme = SCHEME_SLUG[params.scheme]; if (!scheme) notFound();
  const s = await needOfficer(); await refreshStages();
  const tab = searchParams.tab === 'closed' ? 'closed' : 'active';
  const q = (searchParams.q || '').replace(/[^\w\s/-]/g, '');
  const stage = searchParams.stage && STAGE_LABEL[searchParams.stage] ? searchParams.stage : '';
  const page = Math.max(1, Number(searchParams.page || 1));
  const now = new Date(); const fy = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.from || '') ? searchParams.from! : `${fy}-04-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.to || '') ? searchParams.to! : isoDate(now);

  const sort = KEYS[searchParams.sort || ''] && (tab === 'closed' ? ['licence', 'importer', 'ack', 'closed', 'by'] : ['licence', 'importer', 'iec', 'bond', 'stage', 'due']).includes(searchParams.sort!) ? searchParams.sort! : tab === 'closed' ? 'closed' : 'added';
  const dir: Dir = searchParams.sort ? parseDir(searchParams.dir) : 'desc';
  const f: any = { scheme, status: tab };
  if (q) { const r = new RegExp(q, 'i'); f.$or = [{ licenceNo: r }, { iec: r }, { partyName: r }]; }
  if (tab === 'active' && stage) f.stage = stage;
  if (tab === 'closed') f.closedOn = { $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') };
  const [na, nc, total, rows]: any[] = await Promise.all([
    Licence.countDocuments({ scheme, status: 'active' }), Licence.countDocuments({ scheme, status: 'closed' }), Licence.countDocuments(f),
    Licence.aggregate([{ $match: f }, { $addFields: { _k: KEYS[sort]() } },
      { $addFields: { _blank: { $cond: [{ $in: [{ $type: '$_k' }, ['null', 'missing']] }, 1, 0] } } }, // blanks last in both directions
      { $sort: { _blank: 1, _k: dir === 'asc' ? 1 : -1, _id: 1 } }, { $skip: (page - 1) * PAGE }, { $limit: PAGE }]),
  ]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const qs = (o: Record<string, string>) => `/officer/${params.scheme}?${new URLSearchParams({ tab, ...(q && { q }), ...(stage && { stage }), ...(tab === 'closed' && { from, to }), ...(searchParams.sort && { sort, dir }), ...o })}`;
  const sh = (s2: string, d2: Dir) => qs({ sort: s2, dir: d2, page: '1' });
  const T = (label: string, k?: string) => <SortTh label={label} k={k} sort={sort} dir={dir} href={sh} />;
  const exp = `/api/officer/export?kind=licences&scheme=${scheme}&status=${tab}${tab === 'closed' ? `&from=${from}&to=${to}` : ''}`;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › {scheme}</div>
      <div className="row end" style={{ marginTop: 0 }}>
        <Tabs items={[{ href: `/officer/${params.scheme}?tab=active`, label: `Active (${inr(na)})`, active: tab === 'active' }, { href: `/officer/${params.scheme}?tab=closed`, label: `Closed (${inr(nc)})`, active: tab === 'closed' }]} />
        <form className="row" style={{ marginTop: 0 }}>
          <input type="hidden" name="tab" value={tab} />
          {searchParams.sort && <><input type="hidden" name="sort" value={sort} /><input type="hidden" name="dir" value={dir} /></>}
          {tab === 'active' ? <select name="stage" defaultValue={stage} aria-label="Stage" style={{ width: 170 }}><option value="">Stage: All</option>{Object.entries(STAGE_LABEL).filter(([k]) => k !== 'closed').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            : <><input type="date" name="from" defaultValue={from} aria-label="Closed from" style={{ width: 150 }} /><input type="date" name="to" defaultValue={to} aria-label="Closed to" style={{ width: 150 }} /></>}
          <input name="q" defaultValue={q} placeholder="Search licence, IEC, party" aria-label="Search" style={{ width: 230 }} />
          <button className="small">Filter</button>
          {tab === 'closed' && <a className="btn ghost small" href={exp}>Export Excel</a>}
        </form>
      </div>
      <table className="grid">
        {tab === 'active' ? <>
          <thead><tr>{T('Licence', 'licence')}{T('Importer', 'importer')}{T('IEC', 'iec')}{T('Bond date', 'bond')}{T('Stage', 'stage')}{T('Next due', 'due')}</tr></thead>
          <tbody>{rows.map((l: any) => { const isNew = l.stage === 'new' && new Date(l.createdAt) >= today; const bad = ['defaulter', 'adjudication'].includes(l.stage);
            return <tr key={l.licenceNo} className={isNew ? 'hl' : ''}><td className="link"><Link href={`/officer/licence/${l.licenceNo}`}>{l.licenceNo}</Link></td><td>{l.partyName}</td><td>{l.iec}</td><td>{fmtDate(l.bondDate)}</td>
              <td className={bad ? 'warn' : ''}>{isNew ? 'New · added today' : STAGE_LABEL[l.stage]}</td><td className={bad ? 'warn' : ''}>{nextDue(l)}</td></tr>; })}</tbody>
        </> : <>
          <thead><tr>{T('Licence', 'licence')}{T('Importer', 'importer')}{T('EODC ack no.', 'ack')}{T('Closed on', 'closed')}{T('EODC action over by', 'by')}</tr></thead>
          <tbody>{rows.map((l: any) => <tr key={l.licenceNo}><td className="link"><Link href={`/officer/licence/${l.licenceNo}`}>{l.licenceNo}</Link></td><td>{l.partyName}</td><td>{l.closingAckNo}</td><td>{fmtDate(l.closedOn)}</td><td>{l.closedBy}</td></tr>)}</tbody>
        </>}
        {!rows.length && <tbody><tr><td colSpan={6} className="note">No licences match.</td></tr></tbody>}
      </table>
      <div className="row end"><span className="note">{tab === 'active' ? 'Every licence number opens its licence page. Licences saved through Add new licence appear here automatically.' : 'No manual “move to closed” step. A licence moves here when its EODC is marked Action over.'}</span>
        <span className="row" style={{ margin: 0 }}>{page > 1 && <Link className="btn ghost small" href={qs({ page: String(page - 1) })}>Previous</Link>}{page * PAGE < total && <Link className="btn ghost small" href={qs({ page: String(page + 1) })}>Next</Link>}</span></div>
    </Shell>
  );
}
