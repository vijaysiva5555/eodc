import mongoose, { Schema } from 'mongoose';
const s = new Schema({
  iec: { type: String, unique: true, required: true, uppercase: true, match: /^[A-Z0-9]{10}$/ },
  name: { type: String, required: true },
  address: String,
  email: { type: String, required: true },   // e-Bond contact email
  altEmail: String,                          // optional second e-mail: gets a copy of every notice (not used for login)
  mobile: { type: String, required: true },  // e-Bond contact mobile
  registered: { type: Boolean, default: false },
}, { timestamps: true });
export const Importer = mongoose.models.Importer || mongoose.model('Importer', s);
