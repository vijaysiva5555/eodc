import Link from 'next/link';
import Shell from '@/components/Shell';
import ReportsClient from '@/components/ReportsClient';
import { needOfficer } from '@/lib/guard';
import { REPORTS } from '@/lib/reports';
import { isoDate } from '@/lib/format';

export default async function Reports() {
  const s = await needOfficer();
  const now = new Date(); const fy = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Reports</div>
      <h2>Reports</h2>
      <p className="note">Pick a report, set the period, view it and export to Excel.</p>
      <ReportsClient reports={REPORTS.map((r) => ({ ...r }))} from0={`${fy}-04-01`} to0={isoDate(now)} />
    </Shell>
  );
}
