import mongoose, { Schema } from 'mongoose';

export const STAGES = [
  'new', 'ic_pending', 'ic_received', 'eo_running', 'eodc_received',
  'query_raised', 'defaulter', 'adjudication', 'closed',
] as const;

const Bond = new Schema({
  bondNo: String, bondDate: Date, amount: Number, executedAt: String,
  status: { type: String, default: 'Live' },
}, { _id: false });

const BG = new Schema({
  bgNo: String, bank: String, branch: String, amount: Number, validTill: Date, linkedBond: String,
}, { _id: false });

const Attachment = new Schema({
  fileName: String, docType: { type: String, enum: ['DGFT licence', 'e-Bond', 'e-BG'] },
  pages: Number, path: String, uploadedBy: String, uploadedAt: { type: Date, default: Date.now },
}, { _id: false }); // append-only: replaced docs are added, never overwritten

const Letter = new Schema({ // Alerts and simple notices uploaded by officers
  kind: { type: String, enum: ['alert', 'notice'] },
  title: String, letterNo: String, date: Date, path: String, uploadedBy: String, system: Boolean,
}, { _id: false });

const Adjudication = new Schema({
  scn: { no: String, date: Date, dutyAmount: Number, interest: Boolean, path: String, by: String },
  ph: [{ phDate: Date, hearingDate: Date, outcome: String, path: String, by: String }],
  oio: { no: String, date: Date, outcome: String, path: String, by: String },
  concluded: { type: Boolean, default: false },
}, { _id: false });

const s = new Schema({
  licenceNo: { type: String, unique: true, required: true },
  scheme: { type: String, enum: ['EPCG', 'DEEC'], required: true, index: true },
  licenceDate: Date,
  iec: { type: String, index: true, required: true },
  partyName: String,
  issuingOffice: String,
  dutySaved: Number,
  eoMultiple: Number,
  eoAmount: Number,         // dutySaved x eoMultiple
  eoEndsOn: Date,
  bondDate: Date,           // first bond date, used for lists and reports
  icDueOn: Date,
  eoBlockDueOn: Date,
  scnFlagged: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'closed'], default: 'active', index: true },
  stage: { type: String, enum: STAGES, default: 'new' },
  bonds: [Bond], bgs: [BG], attachments: [Attachment], letters: [Letter],
  adjudication: Adjudication,
  closedOn: Date, closedBy: String, closingAckNo: String,
  corrections: [{ field: String, from: String, to: String, by: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

s.index({ licenceNo: 'text', partyName: 'text', iec: 'text' });
export const Licence = mongoose.models.Licence || mongoose.model('Licence', s);
