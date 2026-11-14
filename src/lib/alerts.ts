import { Licence } from '@/models/Licence';
import { actionTaken, RULES, refreshStages } from './rules';
import { fmtDate, inr, daysPast } from './format';

export type AlertTab = 'ic' | 'eo' | 'bg' | 'block';
export const ALERT_TABS: { key: AlertTab; label: string }[] = [
  { key: 'ic', label: 'IC overdue' }, { key: 'eo', label: 'EO expired, no EODC' },
  { key: 'bg', label: 'BG expiring' }, { key: 'block', label: 'EO block due' },
];
const day = 864e5;
const filters = () => {
  const now = new Date();
  return {
    ic: { status: 'active', stage: { $in: ['new', 'ic_pending'] }, icDueOn: { $lt: now } },
    eo: { status: 'active', stage: { $in: ['defaulter', 'adjudication'] }, eoEndsOn: { $lt: now } },
    bg: { status: 'active', 'bgs.validTill': { $gte: now, $lte: new Date(+now + RULES.bgAlertDays * day) } },
    block: { status: 'active', stage: { $nin: ['adjudication', 'defaulter'] }, eoBlockDueOn: { $gte: now, $lte: new Date(+now + RULES.blockAlertDays * day) } },
  } as Record<AlertTab, object>;
};

export async function alertCounts() {
  await refreshStages();
  const f = filters();
  const [ic, eo, bg, block] = await Promise.all(ALERT_TABS.map((t) => Licence.countDocuments(f[t.key])));
  return { ic, eo, bg, block } as Record<AlertTab, number>;
}

export async function alertList(tab: AlertTab) {
  await refreshStages();
  const now = new Date();
  const docs: any[] = await Licence.find(filters()[tab]).sort({ eoEndsOn: 1 }).limit(500).lean();
  const base = ['Licence', 'Importer'];
  if (tab === 'ic') return {
    columns: [...base, 'IC due', 'Days past', 'Duty saved (₹)', 'Action taken'],
    rows: docs.map((l) => ({ licenceNo: l.licenceNo, cells: [l.licenceNo, l.partyName, fmtDate(l.icDueOn), String(daysPast(l.icDueOn)), inr(l.dutySaved), actionTaken(l)] })) };
  if (tab === 'eo') return {
    columns: [...base, 'EO ended', 'Days past', 'Duty saved (₹)', 'Action taken'],
    rows: docs.map((l) => ({ licenceNo: l.licenceNo, cells: [l.licenceNo, l.partyName, fmtDate(l.eoEndsOn), String(daysPast(l.eoEndsOn)), inr(l.dutySaved), actionTaken(l)] })) };
  if (tab === 'bg') return {
    columns: [...base, 'BG no.', 'Valid till', 'Days left', 'BG amount (₹)', 'Action taken'],
    rows: docs.flatMap((l) => (l.bgs || []).filter((b: any) => new Date(b.validTill) >= now && +new Date(b.validTill) <= +now + RULES.bgAlertDays * day)
      .map((b: any) => ({ licenceNo: l.licenceNo, cells: [l.licenceNo, l.partyName, b.bgNo, fmtDate(b.validTill), String(-daysPast(b.validTill)), inr(b.amount), actionTaken(l)] }))) };
  return {
    columns: [...base, 'Block due', 'Days left', 'Duty saved (₹)', 'Action taken'],
    rows: docs.map((l) => ({ licenceNo: l.licenceNo, cells: [l.licenceNo, l.partyName, fmtDate(l.eoBlockDueOn), String(-daysPast(l.eoBlockDueOn)), inr(l.dutySaved), actionTaken(l)] })) };
}
