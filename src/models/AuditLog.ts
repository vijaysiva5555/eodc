import mongoose, { Schema } from 'mongoose';
const s = new Schema({
  actor: { type: String, index: true },   // officer user ID or importer IEC
  name: String,                           // display name at the time of the action
  role: { type: String, index: true },    // importer | officer | admin | superadmin | system
  action: { type: String, index: true }, target: String, meta: Schema.Types.Mixed,
  at: { type: Date, default: Date.now, index: true },
});
export const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', s);
