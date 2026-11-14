import mongoose, { Schema } from 'mongoose';
const s = new Schema({
  iec: { type: String, index: true },
  hash: String,
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, expires: 0 }, // TTL: Mongo deletes the doc at expiresAt
});
export const Otp = mongoose.models.Otp || mongoose.model('Otp', s);
