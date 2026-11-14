const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n: number) => String(n).padStart(2, '0');

// Date-only values are stored as UTC midnight, so UTC getters are used.
export function fmtDate(d?: Date | string | null) {
  if (!d) return '–';
  const x = new Date(d); if (isNaN(+x)) return '–';
  return `${p2(x.getUTCDate())}-${M[x.getUTCMonth()]}-${x.getUTCFullYear()}`;
}
export function fmtMonth(ym: string) { const [y, m] = ym.split('-'); return m ? `${M[+m - 1]}-${y}` : y; }
// Timestamps (submitted at, etc.) are shown in IST
export function fmtTs(d?: Date | string | null) {
  if (!d) return '–';
  const s = new Date(d).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return s.replace(/ /g, '-').replace(',-', ', ').replace(/(\w{3})-(\d{4})/, '$1-$2');
}
export function fmtDay(d?: Date | string | null) { // timestamp -> dd-Mon-yyyy in IST
  if (!d) return '–';
  const x = new Date(new Date(d).getTime() + 5.5 * 3600e3);
  return `${p2(x.getUTCDate())}-${M[x.getUTCMonth()]}-${x.getUTCFullYear()}`;
}
export const inr = (n?: number | null) => (n == null ? '–' : new Intl.NumberFormat('en-IN').format(n));
export const rs = (n?: number | null) => (n == null ? '–' : `₹ ${inr(n)}`);
export const ageDays = (d: Date | string) => Math.max(0, Math.floor((Date.now() - +new Date(d)) / 864e5));
export const daysPast = (d: Date | string) => Math.floor((Date.now() - +new Date(d)) / 864e5);
export const plain = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
export const isoDate = (d?: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const STAGE_LABEL: Record<string, string> = {
  new: 'New', ic_pending: 'IC pending', ic_received: 'IC received', eo_running: 'EO running',
  eodc_received: 'EODC received', query_raised: 'EODC: query raised', defaulter: 'Defaulter',
  adjudication: 'In adjudication', closed: 'Closed',
};
export const SUB_STATUS: Record<string, string> = { received: 'Received', query_raised: 'Query raised', action_over: 'Action over' };
export const SUB_TYPE: Record<string, string> = { IC: 'Installation certificate', EODC: 'EODC', DL: 'DL reply', MS: 'Other document' };
export const INBOX_SLUG: Record<string, string> = { ic: 'IC', eodc: 'EODC', dl: 'DL', ms: 'MS' };
export const SCHEME_SLUG: Record<string, 'EPCG' | 'DEEC'> = { epcg: 'EPCG', deec: 'DEEC' };
export const SCHEME_NAME: Record<string, string> = { EPCG: 'EPCG', DEEC: 'DEEC / Advance Authorisation' };
