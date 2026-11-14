import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import Tabs from '@/components/Tabs';
import DataTable from '@/components/DataTable';
import { time } from '@/lib/sort';
import { needImporter } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { fmtDate, inr, SCHEME_SLUG } from '@/lib/format';
import { importerStatus, importerStatusWarn } from '@/lib/rules';

export default async function ImporterList({ params, searchParams }: { params: { scheme: string }; searchParams: { tab?: string; q?: string } }) {
  const scheme = SCHEME_SLUG[params.scheme]; if (!scheme) notFound();
  const s = await needImporter();
  const tab = searchParams.tab === 'closed' ? 'closed' : 'active';
  const q = (searchParams.q || '').replace(/[^\w/-]/g, '');
  const base: any = { iec: s.iec, scheme };
  const [na, nc]: number[] = await Promise.all([Licence.countDocuments({ ...base, status: 'active' }), Licence.countDocuments({ ...base, status: 'closed' })]);
  const f: any = { ...base, status: tab };
  if (q) f.$or = [{ licenceNo: new RegExp(q, 'i') }, { 'bonds.bondNo': new RegExp(q, 'i') }];
  const rows: any[] = await Licence.find(f).sort({ licenceDate: -1 }).lean();
  const href = (t: string) => `/importer/${params.scheme}?tab=${t}`;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/importer">Home</Link> › {scheme}</div>
      <div className="row end" style={{ marginTop: 0 }}>
        <Tabs items={[{ href: href('active'), label: `Active (${na})`, active: tab === 'active' }, { href: href('closed'), label: `Closed (${nc})`, active: tab === 'closed' }]} />
        <form style={{ width: 280 }}><input type="hidden" name="tab" value={tab} /><input name="q" defaultValue={q} placeholder="Search licence or bond no." aria-label="Search" /></form>
      </div>
      <DataTable
        columns={[{ label: 'Licence no.' }, { label: 'Licence date' }, { label: 'Bond no.' }, { label: 'Duty saved (₹)', align: 'r' }, { label: 'EO ends' }, { label: 'Status' }]}
        rows={rows.map((l) => ({
          key: l.licenceNo,
          cells: [<Link key="l" href={`/importer/licence/${l.licenceNo}`}>{l.licenceNo}</Link>, fmtDate(l.licenceDate), l.bonds?.[0]?.bondNo, inr(l.dutySaved), fmtDate(l.eoEndsOn), importerStatus(l)],
          sort: [l.licenceNo, time(l.licenceDate), l.bonds?.[0]?.bondNo, l.dutySaved, time(l.eoEndsOn), importerStatus(l)],
          cellClass: ['link', '', '', '', '', importerStatusWarn(l) ? 'warn' : ''],
        }))}
        empty={q ? 'No licence matches your search.' : `No ${tab} licences yet.`} />
    </Shell>
  );
}
