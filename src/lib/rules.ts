import { Licence } from '@/models/Licence';
import { fmtDate } from './format';

// Due-date rules. Derived from the sample data in the mock-ups: please confirm against the policy.
export const RULES = {
  icMonthsAfterBond: 6,   // Meera Pharma: bond 28-Oct-2026 -> IC Apr-2027
  epcgEoYears: 6,         // licence 03-Mar-2026 -> EO ends 02-Mar-2032
  epcgBlockYears: 4,      // licence 12-Jan-2025 -> block Jan-2029
  aaEoMonths: 18,         // ASSUMPTION for DEEC/AA, not shown in the deck
  eoMultiple: 6,          // EO = 6 x duty saved (EPCG)
  bgAlertDays: 30,
  blockAlertDays: 90,
};

export function addMonths(d: Date, m: number) {
  const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + m); return x;
}
export function deriveDates(scheme: string, licenceDate: Date, bondDate?: Date | null) {
  const months = scheme === 'EPCG' ? RULES.epcgEoYears * 12 : RULES.aaEoMonths;
  const eoEndsOn = new Date(addMonths(licenceDate, months).getTime() - 864e5);
  return {
    eoEndsOn,
    icDueOn: scheme === 'EPCG' && bondDate ? addMonths(bondDate, RULES.icMonthsAfterBond) : undefined,
    eoBlockDueOn: scheme === 'EPCG' ? addMonths(licenceDate, RULES.epcgBlockYears * 12) : undefined,
  };
}

export function nextDue(l: any): string {
  const now = new Date();
  if (l.status === 'closed') return '–';
  if (l.stage === 'eodc_received' || l.stage === 'query_raised') return 'EODC action';
  if (l.stage === 'defaulter' || l.stage === 'adjudication') return 'In adjudication';
  const c: { label: string; date: Date }[] = [];
  if (['new', 'ic_pending'].includes(l.stage) && l.icDueOn) c.push({ label: 'IC', date: new Date(l.icDueOn) });
  const bg = (l.bgs || []).map((b: any) => new Date(b.validTill)).filter((d: Date) => d >= now).sort((a: Date, b: Date) => +a - +b)[0];
  if (bg) c.push({ label: 'BG', date: bg });
  if (l.eoBlockDueOn && new Date(l.eoBlockDueOn) >= now) c.push({ label: 'Block', date: new Date(l.eoBlockDueOn) });
  c.sort((a, b) => +a.date - +b.date);
  return c[0] ? `${c[0].label} · ${fmtDate(c[0].date)}` : '–';
}

export function importerStatus(l: any) {
  switch (l.stage) {
    case 'closed': return 'Closed';
    case 'query_raised': return 'EODC: query raised';
    case 'new': return 'Registered';
    case 'ic_pending': return l.icDueOn ? `IC due ${fmtDate(l.icDueOn)}` : 'IC pending';
    case 'eodc_received': return 'EODC under examination';
    case 'defaulter': case 'adjudication': return 'Under adjudication';
    default: return 'EO running';
  }
}
export const importerStatusWarn = (l: any) => ['ic_pending', 'query_raised', 'defaulter', 'adjudication'].includes(l.stage);

// Moves stages that depend on dates. Idempotent and cheap; called when officer pages load.
export async function refreshStages() {
  const now = new Date();
  const dayAgo = new Date(+now - 864e5);
  // Installation certificate applies to EPCG only; a new DEEC/AA licence goes straight to EO running.
  await Licence.updateMany({ status: 'active', stage: 'new', scheme: 'EPCG', createdAt: { $lt: dayAgo } }, { stage: 'ic_pending' });
  await Licence.updateMany({ status: 'active', stage: 'new', scheme: 'DEEC', createdAt: { $lt: dayAgo } }, { stage: 'eo_running' });
  await Licence.updateMany(
    { status: 'active', stage: { $in: ['new', 'ic_pending', 'ic_received', 'eo_running'] }, eoEndsOn: { $lt: now } },
    { stage: 'defaulter' });
}

// "Action taken" column on the alerts screen
export function actionTaken(l: any) {
  const adj = l.adjudication;
  if (adj?.oio?.no || adj?.concluded) return 'OIO issued';
  if (adj?.scn?.no) return adj.ph?.length ? 'SCN issued; PH held' : 'SCN issued';
  if (l.scnFlagged) return 'Flagged for SCN';
  const last = (l.letters || []).slice(-1)[0];
  return last ? last.title : 'None yet';
}
