import mongoose, { Schema } from 'mongoose';
const s = new Schema({
  userId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  designation: { type: String, enum: ['Superintendent', 'DA', 'Admin', 'Super Admin'], required: true },
  passwordHash: { type: String, required: true },
  // superadmin: manages admins and officers, only role that sees the activity log (created by scripts/create-superadmin.ts)
  // admin: manages officer accounts. officer: day-to-day work.
  role: { type: String, enum: ['superadmin', 'admin', 'officer'], default: 'officer' },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLoginAt: Date,
}, { timestamps: true });
export const Officer = mongoose.models.Officer || mongoose.model('Officer', s);
