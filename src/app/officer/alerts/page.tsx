import Link from 'next/link';
import Shell from '@/components/Shell';
import Tabs from '@/components/Tabs';
import AlertsTable from '@/components/AlertsTable';
import { needOfficer } from '@/lib/guard';
import { alertCounts, alertList, ALERT_TABS, AlertTab } from '@/lib/alerts';

export default async function Alerts({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await needOfficer();
  const tab = (ALERT_TABS.some((t) => t.key === searchParams.tab) ? searchParams.tab : 'ic') as AlertTab;
  const [counts, list] = await Promise.all([alertCounts(), alertList(tab)]);
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Alerts and defaulters</div>
      <Tabs items={ALERT_TABS.map((t) => ({ href: `/officer/alerts?tab=${t.key}`, label: `${t.label} (${counts[t.key]})`, active: t.key === tab }))} />
      <AlertsTable key={tab} tab={tab} columns={list.columns} rows={list.rows} />
      <p className="note">Built from the due-date rules; each tab is a ready action list.</p>
    </Shell>
  );
}
