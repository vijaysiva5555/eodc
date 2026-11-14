import mongoose, { Schema } from 'mongoose';
const s = new Schema({
  ackNo: { type: String, unique: true },
  type: { type: String, enum: ['IC', 'EODC', 'DL', 'MS'], required: true, index: true },
  licenceNo: { type: String, index: true },
  iec: { type: String, index: true },
  partyName: String,
  details: Schema.Types.Mixed, // IC: {certifiedBy, certDate}; EODC: {eodcNo, eodcDate}; ...
  filePath: String, fileName: String, fileSize: Number,
  status: { type: String, enum: ['received', 'query_raised', 'action_over'], default: 'received', index: true },
  assignedTo: String,
  query: { text: String, raisedOn: Date, replyBy: Date, raisedBy: String },
  reply: { text: String, repliedOn: Date, filePath: String },
  action: { by: String, on: Date, remarks: String, eOfficeRef: String },
}, { timestamps: true });
export const Submission = mongoose.models.Submission || mongoose.model('Submission', s);
