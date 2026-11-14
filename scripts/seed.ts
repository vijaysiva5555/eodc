// Loads the dummy data from the screen mock-ups. Run: npm run seed   (add --reset to wipe and reload)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import { Importer } from '../src/models/Importer';
import { Officer } from '../src/models/Officer';
import { Licence } from '../src/models/Licence';
import { Submission } from '../src/models/Submission';
import { Counter } from '../src/models/Counter';
import { AuditLog } from '../src/models/AuditLog';
import { Otp } from '../src/models/Otp';
import { deriveDates, RULES } from '../src/lib/rules';
import { makePdf } from '../src/lib/samplepdf';
import { putFile } from '../src/lib/storage';

const d = (s: string) => new Date(s);
// sample PDFs go to the same place as real uploads (S3 when AWS_S3_BUCKET is set, else ./storage)
const pdf = async (rel: string, lines: string[]) => { await putFile(rel, makePdf(lines)); return rel; };

const IMP = {
  A: { iec: 'ABCDE1234F', name: 'Aarav Textiles Pvt Ltd', address: 'Plot 22, Pandesara GIDC, Surat 394221', email: 'accounts@aaravtex.in', mobile: '+919825043210', registered: true },
  M: { iec: 'PQRST6789K', name: 'Meera Pharma Ltd', address: 'Plot 4, GIDC, Vadodara', email: 'info@meerapharma.in', mobile: '+919800000001', registered: false },
  K: { iec: 'LMNOP4567Q', name: 'Kaveri Engineering Works', address: 'Udhna, Surat', email: 'info@kaveri.in', mobile: '+919800000002', registered: true },
  S: { iec: 'UVWXY2345Z', name: 'Sunrise Polymers', address: 'Sachin GIDC, Surat', email: 'info@sunrise.in', mobile: '+919800000003', registered: true },
  N: { iec: 'NAVKR3456M', name: 'Navkar Agro Foods', address: 'Kadodara, Surat', email: 'info@navkar.in', mobile: '+919800000004', registered: true },
} as const;
type K = keyof typeof IMP;

type L = { no: string; who: K; licDate: string; duty: number; bondNo: string; bondDate: string; bondAmt: number; stage: string; scheme?: 'EPCG' | 'DEEC'; bg?: [string, number, string]; icDue?: string; extra?: any; closed?: { on: string; by: string; ack: string }; createdAt?: string };
const LICENCES: L[] = [
  // Aarav Textiles (importer sample)
  { no: '0331001842', who: 'A', licDate: '2025-01-12', duty: 4860000, bondNo: 'EB/2025/00412', bondDate: '2025-01-20', bondAmt: 5000000, stage: 'eo_running' },
  { no: '0331002217', who: 'A', licDate: '2026-03-03', duty: 2215500, bondNo: 'EB/2026/00188', bondDate: '2026-04-10', bondAmt: 2500000, stage: 'ic_pending', icDue: '2026-12-15', bg: ['BG/2026/7781', 332000, '2027-04-09'] },
  { no: '0331000976', who: 'A', licDate: '2020-08-21', duty: 3140000, bondNo: 'EB/2020/00975', bondDate: '2020-08-27', bondAmt: 3400000, stage: 'query_raised', bg: ['BG/2020/3318', 471000, '2027-08-24'] },
  { no: '0331002390', who: 'A', licDate: '2026-07-18', duty: 975000, bondNo: 'EB/2026/00341', bondDate: '2026-07-25', bondAmt: 1100000, stage: 'new', createdAt: '2026-07-25' },
  { no: '0330008811', who: 'A', licDate: '2019-10-01', duty: 2000000, bondNo: 'EB/2019/00811', bondDate: '2019-10-10', bondAmt: 2200000, stage: 'closed', closed: { on: '2026-10-24', by: 'R. Sharma, Supdt.', ack: 'EODC/EO/2026/00861' } },
  { no: '0310045123', who: 'A', scheme: 'DEEC', licDate: '2025-06-10', duty: 1500000, bondNo: 'EB/2025/00655', bondDate: '2025-06-18', bondAmt: 1700000, stage: 'eo_running' },
  { no: '0310045200', who: 'A', scheme: 'DEEC', licDate: '2026-02-12', duty: 900000, bondNo: 'EB/2026/00120', bondDate: '2026-02-20', bondAmt: 1000000, stage: 'ic_received' },
  // Meera Pharma
  { no: '0331002481', who: 'M', licDate: '2026-10-22', duty: 3000000, bondNo: 'EB/2026/00377', bondDate: '2026-10-28', bondAmt: 1800000, stage: 'new', bg: ['BG/2026/7790', 240000, '2027-10-27'] },
  { no: '0331002144', who: 'M', licDate: '2026-05-04', duty: 1200000, bondNo: 'EB/2026/00201', bondDate: '2026-05-12', bondAmt: 1400000, stage: 'ic_pending' },
  { no: '0331000851', who: 'M', licDate: '2020-07-20', duty: 895000, bondNo: 'EB/2020/00851', bondDate: '2020-07-28', bondAmt: 1000000, stage: 'defaulter' },
  { no: '0330005879', who: 'M', licDate: '2019-03-01', duty: 1800000, bondNo: 'EB/2019/00300', bondDate: '2019-03-10', bondAmt: 2000000, stage: 'closed', closed: { on: '2026-06-12', by: 'A. Khan, Supdt.', ack: 'EODC/EO/2026/00398' } },
  // Kaveri Engineering
  { no: '0331001507', who: 'K', licDate: '2023-05-25', duty: 2500000, bondNo: 'EB/2023/00601', bondDate: '2023-06-02', bondAmt: 2800000, stage: 'eo_running', bg: ['BG/2023/1507', 300000, '2026-11-29'] },
  { no: '0331002305', who: 'K', licDate: '2026-06-10', duty: 1100000, bondNo: 'EB/2026/00260', bondDate: '2026-06-18', bondAmt: 1200000, stage: 'ic_pending' },
  { no: '0331000802', who: 'K', licDate: '2020-06-06', duty: 3610000, bondNo: 'EB/2020/00802', bondDate: '2020-06-12', bondAmt: 3900000, stage: 'defaulter' },
  { no: '0330007345', who: 'K', licDate: '2019-06-01', duty: 1700000, bondNo: 'EB/2019/00420', bondDate: '2019-06-10', bondAmt: 1900000, stage: 'closed', closed: { on: '2026-09-19', by: 'A. Khan, Supdt.', ack: 'EODC/EO/2026/00702' } },
  // Sunrise Polymers
  { no: '0331000713', who: 'S', licDate: '2020-02-14', duty: 2780000, bondNo: 'EB/2020/00301', bondDate: '2020-02-14', bondAmt: 3000000, stage: 'adjudication' },
  { no: '0331002098', who: 'S', licDate: '2026-04-02', duty: 800000, bondNo: 'EB/2026/00150', bondDate: '2026-04-10', bondAmt: 900000, stage: 'ic_pending' },
  { no: '0331000940', who: 'S', licDate: '2020-09-03', duty: 1940000, bondNo: 'EB/2020/00940', bondDate: '2020-09-10', bondAmt: 2100000, stage: 'defaulter' },
  // Navkar Agro Foods
  { no: '0331001977', who: 'N', licDate: '2026-03-20', duty: 1000000, bondNo: 'EB/2026/00099', bondDate: '2026-03-28', bondAmt: 1100000, stage: 'ic_pending' },
  { no: '0331000688', who: 'N', licDate: '2020-03-31', duty: 1425000, bondNo: 'EB/2020/00688', bondDate: '2020-04-06', bondAmt: 1600000, stage: 'defaulter', extra: { scnFlagged: true } },
  { no: '0330006102', who: 'N', licDate: '2019-02-01', duty: 1500000, bondNo: 'EB/2019/00210', bondDate: '2019-02-10', bondAmt: 1700000, stage: 'closed', closed: { on: '2026-07-30', by: 'R. Sharma, Supdt.', ack: 'EODC/EO/2026/00544' } },
];

async function main() {
  await connectDB();
  if (await Licence.estimatedDocumentCount()) {
    if (!process.argv.includes('--reset')) { console.error('Database already has licences. Re-run with --reset to wipe and reload the dummy data.'); process.exit(1); }
    await Promise.all([Importer, Officer, Licence, Submission, Counter, AuditLog, Otp].map((m: any) => m.deleteMany({})));
  }
  await Importer.insertMany(Object.values(IMP));
  const hash = await bcrypt.hash('Officer@123', 10); // DEV ONLY
  await Officer.insertMany([
    { userId: 'superadmin', name: 'Super Admin', designation: 'Super Admin', role: 'superadmin', passwordHash: hash },
    { userId: 'rsharma', name: 'R. Sharma', designation: 'Superintendent', role: 'admin', passwordHash: hash },
    { userId: 'akhan', name: 'A. Khan', designation: 'Superintendent', passwordHash: hash },
    { userId: 'pnair', name: 'P. Nair', designation: 'DA', passwordHash: hash },
    { userId: 'siyer', name: 'S. Iyer', designation: 'DA', passwordHash: hash },
  ]);

  const todayStr = new Date().toISOString().slice(0, 10);
  for (const x of LICENCES) {
    const im = IMP[x.who]; const scheme = x.scheme || 'EPCG';
    const dd = deriveDates(scheme, d(x.licDate), d(x.bondDate));
    const base = `licences/${x.no}`;
    const att = [
      { fileName: `Licence_${x.no}.pdf`, docType: 'DGFT licence', pages: 1, path: await pdf(`${base}/licence.pdf`, ['EPCG AUTHORISATION', `Licence No: ${x.no}`, `Licence Date: ${x.licDate}`, `IEC: ${im.iec}`, `Name of the Licensee: ${im.name}`, `Duty Saved: Rs ${x.duty}`, 'Issued by: DGFT RA, Surat']), uploadedBy: 'P. Nair, DA' },
      { fileName: `eBond_${x.bondNo.replace(/\//g, '-')}.pdf`, docType: 'e-Bond', pages: 1, path: await pdf(`${base}/ebond.pdf`, ['e-Bond (ICEGATE)', `Bond No: ${x.bondNo}`, `Bond Date: ${x.bondDate}`, `Bond Amount: Rs ${x.bondAmt}`, `IEC: ${im.iec}`, 'Executed at: Customs Station', `Email: ${im.email}`]), uploadedBy: 'P. Nair, DA' },
      ...(x.bg ? [{ fileName: `eBG_${x.bg[0].split('/').pop()}.pdf`, docType: 'e-BG', pages: 1, path: await pdf(`${base}/ebg.pdf`, ['e-BG', `BG No: ${x.bg[0]}`, `BG Amount: Rs ${x.bg[1]}`, `Valid till: ${x.bg[2]}`]), uploadedBy: 'P. Nair, DA' }] : []),
    ].map((a) => ({ ...a, uploadedAt: d(x.createdAt || x.licDate) }));
    const doc: any = {
      licenceNo: x.no, scheme, licenceDate: d(x.licDate), iec: im.iec, partyName: im.name, issuingOffice: 'DGFT RA, Surat',
      dutySaved: x.duty, eoMultiple: scheme === 'EPCG' ? RULES.eoMultiple : undefined, eoAmount: scheme === 'EPCG' ? x.duty * RULES.eoMultiple : undefined,
      ...dd, ...(x.icDue ? { icDueOn: d(x.icDue) } : {}), bondDate: d(x.bondDate), stage: x.stage, status: x.closed ? 'closed' : 'active',
      bonds: [{ bondNo: x.bondNo, bondDate: d(x.bondDate), amount: x.bondAmt, executedAt: 'Customs Station', status: x.closed ? 'Cancelled' : 'Live' }],
      bgs: x.bg ? [{ bgNo: x.bg[0], bank: 'Bank name', branch: 'Surat', amount: x.bg[1], validTill: d(x.bg[2]), linkedBond: x.bondNo }] : [],
      attachments: att, ...(x.extra || {}),
    };
    if (x.closed) Object.assign(doc, { closedOn: d(x.closed.on), closedBy: x.closed.by, closingAckNo: x.closed.ack });
    if (x.no === '0331002481') doc.createdAt = new Date(); // "New · added today"
    if (x.createdAt) doc.createdAt = d(x.createdAt);
    // IC for the new Aarav licence is already past due in the mock-up? keep the deck's due date
    if (x.no === '0331000713') {
      const f = (n: string) => pdf(`${base}/${n}.pdf`, [n.toUpperCase(), `Licence ${x.no}`]);
      doc.letters = [
        { kind: 'alert', title: 'EO period over, EODC not received', date: d('2026-02-16'), uploadedBy: 'S. Iyer, DA', path: await f('alert1') },
        { kind: 'alert', title: 'BG expiring: request to bank', date: d('2026-04-01'), uploadedBy: 'S. Iyer, DA', path: await f('alert2') },
        { kind: 'notice', title: 'Submit EODC within 15 days', letterNo: '', date: d('2026-03-10'), uploadedBy: 'S. Iyer, DA', path: await f('notice1') },
        { kind: 'notice', title: 'Reminder notice', letterNo: '', date: d('2026-04-15'), uploadedBy: 'S. Iyer, DA', path: await f('notice2') },
      ];
      doc.adjudication = {
        scn: { no: '[__]/2026-27', date: d('2026-06-12'), dutyAmount: 2780000, interest: true, path: await f('scn'), by: 'R. Sharma, Supdt.' },
        ph: [{ phDate: d('2026-07-15'), hearingDate: d('2026-07-30'), outcome: 'adjourned', by: 'R. Sharma, Supdt.' }, { phDate: d('2026-08-05'), hearingDate: d('2026-08-20'), outcome: 'attended', by: 'R. Sharma, Supdt.' }],
      };
    }
    await Licence.collection.insertOne({ ...(await new Licence(doc).toObject()), ...(doc.createdAt ? { createdAt: doc.createdAt } : { createdAt: new Date(), updatedAt: new Date() }) });
  }

  // submissions
  const subs: any[] = [];
  let n = 0;
  const S = async (o: any) => subs.push({ filePath: await pdf(`submissions/seed_${++n}.pdf`, [`${o.type} ${o.ackNo}`, `Licence ${o.licenceNo}`]), fileSize: 1200000, ...o });
  const who = (l: string) => IMP[LICENCES.find((x) => x.no === l)!.who];
  const ic = (ack: string, lic: string, created: string, by: string, extra: any = {}) => S({ ackNo: ack, type: 'IC', licenceNo: lic, iec: who(lic).iec, partyName: who(lic).name, details: { certifiedBy: 'Chartered Engineer', certDate: created }, fileName: `IC_${lic}.pdf`, assignedTo: by, createdAt: new Date(created + 'T13:10:00Z'), ...extra });
  await ic('EODC/IC/2026/01452', '0331002217', '2026-10-31', 'pnair');
  await ic('EODC/IC/2026/01449', '0331002305', '2026-10-30', 'pnair');
  await ic('EODC/IC/2026/01431', '0331002144', '2026-10-27', 'siyer');
  await ic('EODC/IC/2026/01398', '0331002098', '2026-10-21', 'siyer');
  await ic('EODC/IC/2026/01310', '0331001977', '2026-09-26', '');
  await ic('EODC/IC/2021/00512', '0330008811', '2021-06-14', 'pnair', { status: 'action_over', action: { by: 'R. Sharma, Supdt.', on: d('2021-06-22'), remarks: 'IC verified', eOfficeRef: 'EPCG/2021/512' } });
  await S({ ackNo: 'EODC/EO/2026/00977', type: 'EODC', licenceNo: '0331000976', iec: IMP.A.iec, partyName: IMP.A.name, details: { eodcNo: '[EODC no.]', eodcDate: '2026-09-25' }, fileName: 'EODC_0331000976.pdf', createdAt: d('2026-10-02T09:00:00Z'), status: 'query_raised',
    query: { text: 'Please upload the EODC issued by DGFT along with the bond cancellation request.', raisedOn: d('2026-10-20'), replyBy: d('2026-11-10'), raisedBy: 'R. Sharma, Supdt.' } });
  for (const [l, ack, by] of [['0330008811', 'EODC/EO/2026/00861', 'R. Sharma, Supdt.'], ['0330007345', 'EODC/EO/2026/00702', 'A. Khan, Supdt.'], ['0330006102', 'EODC/EO/2026/00544', 'R. Sharma, Supdt.'], ['0330005879', 'EODC/EO/2026/00398', 'A. Khan, Supdt.']] as const) {
    const c = LICENCES.find((x) => x.no === l)!.closed!;
    await S({ ackNo: ack, type: 'EODC', licenceNo: l, iec: who(l).iec, partyName: who(l).name, details: { eodcNo: '[EODC no.]', eodcDate: c.on }, fileName: `EODC_${l}.pdf`, createdAt: new Date(c.on + 'T05:00:00Z'), status: 'action_over', action: { by, on: d(c.on), remarks: 'EODC verified; licence cancelled', eOfficeRef: `EPCG/2026/${ack.slice(-4)}` } });
  }
  await S({ ackNo: 'EODC/DL/2026/00210', type: 'DL', licenceNo: '0310045123', iec: IMP.A.iec, partyName: IMP.A.name, details: { dlRef: 'DL/2026/118' }, fileName: 'DL_reply.pdf', createdAt: d('2026-09-15T08:00:00Z'), status: 'action_over', action: { by: 'P. Nair, DA', on: d('2026-09-20'), remarks: 'Reply accepted', eOfficeRef: 'DL/2026/210' } });
  await S({ ackNo: 'EODC/MS/2026/00318', type: 'MS', licenceNo: '0331001842', iec: IMP.A.iec, partyName: IMP.A.name, details: { subject: 'Change of factory address' }, fileName: 'letter.pdf', createdAt: d('2026-08-28T08:00:00Z'), status: 'action_over', action: { by: 'S. Iyer, DA', on: d('2026-09-02'), remarks: 'Noted', eOfficeRef: 'MS/2026/318' } });
  await Submission.collection.insertMany(subs.map((s) => ({ updatedAt: s.createdAt, status: 'received', ...s, createdAt: s.createdAt })));

  // acknowledgement counters continue from the sample numbers
  await Counter.insertMany([{ _id: 'ack:IC:2026', seq: 1452 }, { _id: 'ack:EODC:2026', seq: 977 }, { _id: 'ack:DL:2026', seq: 210 }, { _id: 'ack:MS:2026', seq: 318 }]);
  console.log(`Seeded ${LICENCES.length} licences, ${subs.length} submissions (${todayStr}).`);
  console.log('Importer login: IEC ABCDE1234F (OTP shown in dev)  |  Meera Pharma PQRST6789K must Register first (info@meerapharma.in / 9800000001)');
  console.log('Officer login: rsharma / Officer@123 (admin)  |  Super admin: superadmin / Officer@123');
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
