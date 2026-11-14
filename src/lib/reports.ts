import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { fmtMonth, fmtDate, inr, STAGE_LABEL, ageDays } from './format';
import { refreshStages } from './rules';

export const REPORTS = [
  { key: 'registrations', label: 'Licence registrations', hasPeriod: true, hasGroup: true },
  { key: 'ic', label: 'IC submitted', hasPeriod: true, hasGroup: true },
  { key: 'closed', label: 'Licences closed', hasPeriod: true, hasGroup: true },
  { key: 'pendency', label: 'Pendency by age', hasPeriod: false, hasGroup: false },
  { key: 'defaulters', label: 'Defaulters', hasPeriod: false, hasGroup: false },
  { key: 'bgs', label: 'BGs expiring', hasPeriod: true, hasGroup: false },
  { key: 'eo', label: 'EO ending soon', hasPeriod: true, hasGroup: false },
  { key: 'disposal', label: 'Officer-wise disposal', hasPeriod: true, hasGroup: false },
] as const;
export type Report = { columns: string[]; rows: (string | number)[][]; total?: (string | number)[]; align?: ('l' | 'r')[] };
type Q = { report: string; scheme: 'EPCG' | 'DEEC'; from: string; to: string; group: 'month' | 'year' };

const range = (from: string, to: string) => ({ $gte: new Date(from), $lte: new Date(to + 'T23:59:59Z') });
const fmtKey = (g: string) => (g === 'year' ? '%Y' : '%Y-%m');
const crore = (n: number) => (n / 1e7).toFixed(1);
// Submissions carry no scheme; join the licence to filter by the scheme picked on the report.
const bySchemeLookup = { $lookup: { from: 'licences', localField: 'licenceNo', foreignField: 'licenceNo', as: 'l' } };

export async function runReport(q: Q): Promise<Report> {
  const { scheme, from, to, group } = q;
  const keyLabel = group === 'year' ? 'Year' : 'Month';
  const monthly = async (model: any, match: any, dateField: string, extra: any = {}) =>
    model.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: fmtKey(group), date: `$${dateField}` } }, n: { $sum: 1 }, ...extra } }, { $sort: { _id: 1 } }]);

  switch (q.report) {
    case 'registrations': {
      const a = await monthly(Licence, { scheme, bondDate: range(from, to) }, 'bondDate', { duty: { $sum: '$dutySaved' } });
      return { columns: [`${keyLabel} (bond date)`, 'Licences registered', 'Duty saved (₹ crore)'], align: ['l', 'r', 'r'],
        rows: a.map((r: any) => [fmtMonth(r._id), r.n, crore(r.duty)]),
        total: ['Total', a.reduce((s: number, r: any) => s + r.n, 0), crore(a.reduce((s: number, r: any) => s + r.duty, 0))] };
    }
    case 'ic': {
      const a = await Submission.aggregate([
        { $lookup: { from: 'licences', localField: 'licenceNo', foreignField: 'licenceNo', as: 'l' } },
        { $match: { type: 'IC', createdAt: range(from, to), 'l.scheme': scheme } },
        { $group: { _id: { $dateToString: { format: fmtKey(group), date: '$createdAt' } }, n: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'action_over'] }, 1, 0] } } } }, { $sort: { _id: 1 } }]);
      return { columns: [keyLabel, 'IC submitted', 'Action over', 'Pending'], align: ['l', 'r', 'r', 'r'],
        rows: a.map((r: any) => [fmtMonth(r._id), r.n, r.done, r.n - r.done]),
        total: ['Total', ...[0, 1, 2].map((i) => a.reduce((s: number, r: any) => s + (i === 0 ? r.n : i === 1 ? r.done : r.n - r.done), 0))] };
    }
    case 'closed': {
      const a = await monthly(Licence, { scheme, status: 'closed', closedOn: range(from, to) }, 'closedOn', { duty: { $sum: '$dutySaved' } });
      return { columns: [keyLabel, 'Licences closed', 'Duty saved (₹ crore)'], align: ['l', 'r', 'r'],
        rows: a.map((r: any) => [fmtMonth(r._id), r.n, crore(r.duty)]),
        total: ['Total', a.reduce((s: number, r: any) => s + r.n, 0), crore(a.reduce((s: number, r: any) => s + r.duty, 0))] };
    }
    case 'pendency': {
      const subs: any[] = await Submission.aggregate([{ $match: { status: 'received' } }, bySchemeLookup, { $match: { 'l.scheme': scheme } }, { $project: { type: 1, createdAt: 1 } }]);
      const types: [string, string][] = [['IC', 'Installation certificates'], ['EODC', 'EODC'], ['DL', 'DL replies'], ['MS', 'Misc letters']];
      const rows = types.map(([t, label]) => {
        const ages = subs.filter((s) => s.type === t).map((s) => ageDays(s.createdAt));
        const b = [ages.filter((x) => x <= 7).length, ages.filter((x) => x > 7 && x <= 30).length, ages.filter((x) => x > 30).length];
        return [label, ...b, ages.length];
      });
      return { columns: ['Document', '0–7 days', '7–30 days', 'Over 30 days', 'Total'], align: ['l', 'r', 'r', 'r', 'r'], rows,
        total: ['Total', ...[1, 2, 3, 4].map((i) => rows.reduce((s, r) => s + (r[i] as number), 0))] };
    }
    case 'defaulters': {
      await refreshStages();
      const l: any[] = await Licence.find({ scheme, status: 'active', stage: { $in: ['defaulter', 'adjudication'] } }).sort({ eoEndsOn: 1 }).lean();
      return { columns: ['Licence', 'Importer', 'EO ended', 'Duty saved (₹)', 'Stage'], align: ['l', 'l', 'l', 'r', 'l'],
        rows: l.map((x) => [x.licenceNo, x.partyName, fmtDate(x.eoEndsOn), inr(x.dutySaved), STAGE_LABEL[x.stage]]),
        total: ['Total', '', '', inr(l.reduce((s, x) => s + (x.dutySaved || 0), 0)), ''] };
    }
    case 'bgs': {
      const l: any[] = await Licence.find({ scheme, status: 'active', 'bgs.validTill': range(from, to) }).lean();
      const rows = l.flatMap((x) => x.bgs.filter((b: any) => +new Date(b.validTill) >= +new Date(from) && +new Date(b.validTill) <= +new Date(to + 'T23:59:59Z'))
        .map((b: any) => [x.licenceNo, x.partyName, b.bgNo, b.bank || '', inr(b.amount), fmtDate(b.validTill)]));
      return { columns: ['Licence', 'Importer', 'BG no.', 'Bank', 'BG amount (₹)', 'Valid till'], align: ['l', 'l', 'l', 'l', 'r', 'l'], rows };
    }
    case 'eo': {
      const l: any[] = await Licence.find({ scheme, status: 'active', eoEndsOn: range(from, to) }).sort({ eoEndsOn: 1 }).lean();
      return { columns: ['Licence', 'Importer', 'EO ends', 'Duty saved (₹)', 'Stage'], align: ['l', 'l', 'l', 'r', 'l'],
        rows: l.map((x) => [x.licenceNo, x.partyName, fmtDate(x.eoEndsOn), inr(x.dutySaved), STAGE_LABEL[x.stage]]) };
    }
    default: { // disposal
      const a = await Submission.aggregate([{ $match: { status: 'action_over', 'action.on': range(from, to) } },
        bySchemeLookup, { $match: { 'l.scheme': scheme } },
        { $group: { _id: { by: '$action.by', type: '$type' }, n: { $sum: 1 } } }]);
      const by = [...new Set(a.map((r: any) => r._id.by))].sort();
      const g = (b: string, t: string) => a.find((r: any) => r._id.by === b && r._id.type === t)?.n ?? 0;
      const rows = by.map((b) => [b, g(b, 'IC'), g(b, 'EODC'), g(b, 'DL'), g(b, 'MS'), ['IC', 'EODC', 'DL', 'MS'].reduce((s, t) => s + g(b, t), 0)]);
      return { columns: ['Officer', 'IC', 'EODC', 'DL replies', 'Misc', 'Total'], align: ['l', 'r', 'r', 'r', 'r', 'r'], rows,
        total: ['Total', ...[1, 2, 3, 4, 5].map((i) => rows.reduce((s, r) => s + (r[i] as number), 0))] };
    }
  }
}
