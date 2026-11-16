import { pdfInfo } from './files';

// blankOk: the field may be left empty (it is then not flagged "Check")
export type OcrField = { key: string; label: string; value: string; status: 'OK' | 'Check'; source: 'licence' | 'ebond' | 'ebg'; note?: string; blankOk?: boolean };

// Loose date token: also catches OCR noise such as 27-0ct-2O27. It is parsed afterwards (parseDate);
// when parsing fails the raw text is shown to the officer with a Check flag.
const D = '(\\d{1,2}[-/. ][A-Za-z0-9]{1,9}[-/. ][0-9OoIl]{2,4})';
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseDate(s?: string | null): string | null {
  if (!s) return null;
  const m = s.trim().match(/^(\d{1,2})[-/. ](\d{1,2}|[A-Za-z]{3,9})[-/. ](\d{2,4})$/);
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(s.trim()) ? s.trim() : null;
  const mon = /^\d+$/.test(m[2]) ? +m[2] : MON.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  let y = +m[3]; if (y < 100) y += 2000;
  if (!mon || mon > 12 || +m[1] > 31) return null;
  return `${y}-${String(mon).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
}
const num = (s?: string) => (s ? s.replace(/[^\d.]/g, '').replace(/\.$/, '') : '');
// DGFT documents are bilingual: drop Devanagari and other non-Latin text, then tidy spaces and commas.
const clean = (s: string) => s.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s*\n\s*/g, ' ').replace(/,\s*,+/g, ',').replace(/\s{2,}/g, ' ').replace(/^[\s,/:-]+|[\s,/:-]+$/g, '');
const first = (t: string, res: RegExp[]) => { for (const r of res) { const m = t.match(r); if (m?.[1] && clean(m[1])) return clean(m[1]); } return ''; };
const title = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

type Spec = { key: string; label: string; source: OcrField['source']; get: (t: string, all: Record<OcrField['source'], string>) => string; valid: (v: string) => boolean; date?: boolean; optional?: boolean; blankOk?: boolean; hint?: string };
const nonEmpty = (v: string) => v.length > 1;
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
const EMAILS = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const isDate = (v: string) => !!parseDate(v);
const isAmt = (v: string) => /^\d+(\.\d+)?$/.test(v) && +v > 0;

// "Total / कुल 27155114.53 283160.72 5431022.90": the last figure on the first Total row after the "Duty Saved (INR)" column header
function dutySavedTotal(t: string) {
  const i = t.search(/Duty\s*Saved\s*\(INR\)/i);
  if (i < 0) return '';
  const row = t.slice(i).match(/Total\s*\/?[^\d\n]*([\d.,\s]+?)\s*(?:\n|$)/);
  const nums = row?.[1].trim().split(/\s+/) || [];
  return num(nums[nums.length - 1]);
}
// "Request made on November 11 day of 2026" (CBIC Single All-India e-Bond)
function bondRequestDate(t: string) {
  const m = t.match(/Request made on\s+([A-Za-z]{3,9})\s+(\d{1,2})\s+day of\s+(\d{4})/i);
  return m ? `${m[2]}-${m[1]}-${m[3]}` : '';
}
function schemeOf(t: string) {
  const epcg = t.search(/EPCG\s+Authori[sz]ation|Export Promotion Capital Goods\s+Authori[sz]ation/i);
  const aa = t.search(/Advance\s+Authori[sz]ation|\bDEEC\b/i);
  if (epcg >= 0 && (aa < 0 || epcg < aa)) return 'EPCG';
  if (aa >= 0) return 'DEEC';
  return /\bEPCG\b|Export Promotion Capital Goods/i.test(t) ? 'EPCG' : '';
}
const NOT_PARTY_EMAIL = /@(?:[\w-]+\.)*(?:nic\.in|gov\.in|icegate\.gov\.in)$|@(?:[\w-]+\.)*bank\.in$|^bgconfirmation@/i;
const partyEmails = (t: string) => [...new Set((t.match(EMAILS) || []).filter((e) => !NOT_PARTY_EMAIL.test(e)).map((e) => e.toLowerCase()))];

// Bank contact printed on an e-BG: the branch where claims are payable, and the bank's BG confirmation e-mail.
// "All claims under this guarantee will be payable at <branch address> - 560025" / "... BY SENDING EMAIL TO BGCONFIRMATION@HDFC.BANK.IN"
const PIN = '\\b\\d{3}\\s?\\d{3}\\b';
export function bgBankContact(t: string) {
  const bankAddress = first(t, [new RegExp(`payable at\\s+([\\s\\S]{10,300}?${PIN})`, 'i'), new RegExp(`acting through its branch at\\s+([\\s\\S]{10,300}?${PIN})`, 'i'),
    /(?:Branch|Bank)\s*Address\s*[:\-]\s*(.+)/i]).replace(/,(?=\S)/g, ', ');
  const bankEmail = (first(t, [/E-?MAIL\s*(?:TO|ID|ADDRESS)?\s*[:\-]?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i])
    || (t.match(EMAILS) || []).find((e) => !/@(?:[\w-]+\.)*(?:nic|gov)\.in$/i.test(e)) || '').toLowerCase();
  return { bankAddress, bankEmail };
}

// Patterns are tuned to the DGFT Advance Authorisation, the CBIC Single All-India e-Bond and a bank e-BG
// (sample files: license_doc.pdf, bond.pdf, bank_gran.pdf). Older generic patterns follow as fallbacks.
const SPECS: Spec[] = [
  { key: 'licenceNo', label: 'Licence no.', source: 'licence', valid: (v) => /^\d{10}$/.test(v),
    get: (t) => first(t, [/(?:Licen[cs]e|Authori[sz]ation)\s*(?:No\.?|Number)\s*[:\-]?\s*(\d{10})\b/i, /\b(0[0-9]\d{8})\b/]) },
  { key: 'scheme', label: 'Scheme', source: 'licence', valid: (v) => v === 'EPCG' || v === 'DEEC', get: schemeOf },
  { key: 'licenceDate', label: 'Licence date', source: 'licence', valid: isDate, date: true,
    get: (t) => first(t, [new RegExp(`(?:Licen[cs]e|Authori[sz]ation)\\s*Date\\s*[:\\-]?\\s*${D}`, 'i'), new RegExp(`Date of Issue\\s*[:\\-]?\\s*${D}`, 'i')]) },
  { key: 'iec', label: 'IEC', source: 'licence', valid: (v) => /^[A-Z0-9]{10}$/.test(v),
    get: (t) => first(t, [/\bIEC\s*\/[^A-Z0-9\n]*([A-Z0-9]{10})\b/, /\(IEC\)\s*([A-Z0-9]{10})\b/, /(?:IEC|Importer[\s-]*Exporter Code)[^A-Za-z0-9]{0,15}([A-Z0-9]{10})\b/i]).toUpperCase() },
  { key: 'partyName', label: 'Party', source: 'licence', valid: nonEmpty,
    get: (t) => first(t, [/(?:^|\n)\s*Name\s*\/[^A-Za-z\n]*([A-Z][^\n]+)/, /Firm Name\s+([A-Z][^\n]+)/, /This is to certify that\s+(.+?)\s+is issued/i,
      /Name of the (?:Licensee|Importer|Party|exporter)\s*[:\-]?\s*([A-Z][^\n]+)/i, /(?:Licensee|Party)\s*:\s*(.+)/i]) },
  { key: 'dutySaved', label: 'Duty saved', source: 'licence', valid: isAmt,
    get: (t) => dutySavedTotal(t) || num(first(t, [/Duty\s*Saved[^0-9\n]{0,30}\n?[^0-9\n]{0,30}([\d,]+(?:\.\d+)?)/i])) },
  { key: 'eoEndsOn', label: 'EO period ends (export validity)', source: 'licence', valid: isDate, date: true, optional: true,
    get: (t) => first(t, [new RegExp(`Export\\s*Validity\\s*[:\\-]?\\s*${D}`, 'i'), new RegExp(`Export Obligation Period\\s*(?:ends|upto|up to)\\s*[:\\-]?\\s*${D}`, 'i')]) },
  { key: 'issuingOffice', label: 'Issuing office', source: 'licence', valid: nonEmpty,
    get: (t) => {
      const city = first(t, [/Office of the [A-Za-z ]*Director General of Foreign\s+Trade,\s*([A-Za-z ]+)/, /Location:\s*RA\s+([A-Za-z ]+)/]);
      return city ? `DGFT RA, ${title(city)}` : first(t, [/(?:Issued by|Issuing (?:Authority|Office)|Regional Authority)\s*[:\-]\s*(.+)/i]);
    } },
  { key: 'address', label: 'Contact address', source: 'licence', valid: nonEmpty,
    get: (t, all) => first(t, [/Address of Applicant\s*\/[^A-Z0-9\n]*([\s\S]{5,240}?)\n\s*IEC\b/, /Registered Address\s*\n([\s\S]{5,240}?)\n[^\n]*Name of the/])
      || first(all.ebond, [/\(b\)\s*([^\n]+)\n\s*and holding/i, /Address\s*[:\-]\s*(.+)/i]) },
  { key: 'bondNo', label: 'Bond no.', source: 'ebond', valid: (v) => /[A-Z0-9]/i.test(v) && v.length > 3,
    get: (t) => first(t, [/Bond\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Z0-9\/-]{4,})/i]) },
  { key: 'bondDate', label: 'Bond date', source: 'ebond', valid: isDate, date: true,
    get: (t) => bondRequestDate(t) || first(t, [new RegExp(`Bond\\s*Date\\s*[:\\-]?\\s*${D}`, 'i'), /(\d{1,2}-[A-Za-z]{3}-\d{4})\s+\d{1,2}:\d{2}\s*[AP]M/]) },
  { key: 'bondAmount', label: 'Bond amount', source: 'ebond', valid: isAmt,
    get: (t) => num(first(t, [/in the sum of\s*Rs\.?\s*(?:\([a-z]\)\s*)?([\d,]+(?:\.\d+)?)/i, /Bond\s*Amount[^0-9\n]{0,20}([\d,]+(?:\.\d+)?)/i])) },
  { key: 'executedAt', label: 'Executed at', source: 'ebond', valid: nonEmpty,
    get: (t) => first(t, [/behalf of the President of India by\s+[^,\n]+,\s*[^,\n]+,\s*([A-Z0-9]{5,6})\b/i, /Executed\s*at\s*[:\-]?\s*(.+)/i, /Customs\s*Station\s*[:\-]\s*(.+)/i]) },
  { key: 'email', label: 'Contact email', source: 'ebond', valid: isEmail, hint: 'Not printed on the e-Bond: enter the importer’s e-mail',
    get: (t) => (t.match(EMAILS) || []).find((e) => !NOT_PARTY_EMAIL.test(e)) || '' },
  { key: 'altEmail', label: 'Alternative email', source: 'ebond', valid: isEmail, blankOk: true, hint: 'Optional: a second e-mail that gets a copy of every notice',
    get: (t) => partyEmails(t)[1] || '' },
  { key: 'mobile', label: 'Contact mobile', source: 'ebond', valid: (v) => /^[6-9]\d{9}$/.test(v), hint: 'Not printed on the e-Bond: enter the importer’s mobile',
    get: (t) => first(t, [/(?:Mobile|Phone|Contact)[^0-9\n]{0,15}(?:\+?91[\s-]?)?([6-9]\d{9})/i]) },
  { key: 'bgNo', label: 'BG no.', source: 'ebg', valid: (v) => v.length > 3,
    get: (t) => first(t, [/(?:BG|Guarantee)\s*(?:No\.?|Number)\s*[:\-]?\s*([A-Z0-9\/-]{4,})/i]) },
  { key: 'bgAmount', label: 'BG amount', source: 'ebg', valid: isAmt,
    get: (t) => num(first(t, [/(?:BG|Guarantee)\s*Amount\s*[:\-]?\s*(?:INR|Rs\.?)?\s*([\d,]+(?:\.\d+)?)/i, /not exceeding\s*Rs\.?\s*([\d,]+(?:\.\d+)?)/i, /ROUND OFF B\.?G\.? VALUE\s*:\s*Rs\.?\s*([\d,]+)/i])) },
  { key: 'bgValidTill', label: 'BG valid till', source: 'ebg', valid: isDate, date: true,
    get: (t) => first(t, [new RegExp(`(?:Expiry\\s*Date|Valid(?:ity)?\\s*(?:till|upto|up to))\\s*[:\\-]?\\s*${D}`, 'i')]) },
  { key: 'bgBank', label: 'BG bank', source: 'ebg', valid: nonEmpty,
    get: (t) => first(t, [/(?:^|\n)\s*FOR\s+([A-Z][A-Z&. ]*BANK(?: LTD| LIMITED)?)\.?\s*(?:\n|$)/, /\bWE,?\s+([A-Z][A-Za-z&. ]*Bank\s+(?:Ltd|Limited))/, /Bank\s*(?:Name)?\s*[:\-]\s*(.+)/i]) },
  { key: 'bgBranch', label: 'BG branch', source: 'ebg', valid: nonEmpty,
    get: (t) => title(first(t, [/EXPIRY PLACE\s*:\s*([A-Za-z ]+)/i, /Branch\s*[:\-]\s*(.+)/i])) },
  { key: 'bgBankAddress', label: 'BG bank address', source: 'ebg', valid: nonEmpty, blankOk: true, hint: 'Not found on the e-BG: enter it if known',
    get: (t) => bgBankContact(t).bankAddress },
  { key: 'bgBankEmail', label: 'BG bank email', source: 'ebg', valid: isEmail, blankOk: true, hint: 'Not found on the e-BG: enter it if known',
    get: (t) => bgBankContact(t).bankEmail },
];

export async function runOcr(bufs: { licence: Buffer; ebond: Buffer; ebg?: Buffer }) {
  const l = await pdfInfo(bufs.licence);
  const b = await pdfInfo(bufs.ebond);
  const g = bufs.ebg ? await pdfInfo(bufs.ebg) : null;
  const text = { licence: l.text, ebond: b.text, ebg: g?.text ?? '' };
  const fields: OcrField[] = [];
  for (const s of SPECS) {
    if (s.source === 'ebg' && !bufs.ebg) continue; // e-BG is optional
    let value = ''; try { value = s.get(text[s.source], text); } catch {}
    let raw = '';
    if (s.date) { raw = value; value = parseDate(raw) || ''; }
    if (s.optional && !raw && !value) continue; // e.g. export validity is printed on Advance Authorisations only
    let note: string | undefined;
    // cross-checks between the three documents
    if (s.key === 'iec' && value && b.text && !b.text.toUpperCase().includes(value)) note = 'IEC not found on e-Bond';
    if (s.key === 'bgNo' && value && g) {
      const lic = fields.find((f) => f.key === 'licenceNo')?.value;
      if (lic && !g.text.includes(lic)) note = `Licence ${lic} not mentioned on the e-BG`;
    }
    if (s.date && raw && !value) note = `OCR read "${raw}": enter the correct date`;
    if (!value && !note && s.hint) note = s.hint;
    const ok = !value ? !!s.blankOk : s.valid(value) && !note;
    fields.push({ key: s.key, label: s.label, value, source: s.source, status: ok ? 'OK' : 'Check', note, ...(s.blankOk && { blankOk: true }) });
  }
  // a scanned PDF has (almost) no text layer; stamps such as "CBIC Internal" on each page do not count
  const scanned = [l, b].some((x) => x.pages > 0 && x.text.replace(/CBIC Internal/g, '').trim().length < 40 * x.pages / 4);
  return {
    fields, pages: { licence: l.pages, ebond: b.pages, ebg: g?.pages ?? 0 },
    warning: scanned ? 'One or more PDFs have no text layer (scanned). Fill the fields by hand, or connect an image OCR engine.' : undefined,
  };
}
