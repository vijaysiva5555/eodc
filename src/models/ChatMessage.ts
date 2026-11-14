import mongoose, { Schema } from 'mongoose';

// One message in the conversation about a licence, between the importer (IEC login) and the EODC cell (any officer).
const s = new Schema({
  licenceNo: { type: String, required: true, index: true },
  iec: { type: String, required: true, index: true },        // licence owner, used for access checks
  from: { type: String, enum: ['importer', 'officer'], required: true },
  senderId: String,                                           // IEC or officer user ID
  senderName: String,                                         // "Aarav Textiles Pvt Ltd" / "R. Sharma, Supdt."
  text: { type: String, default: '' },
  // optional attachment, stored like other uploads ("mime", not "type": Mongoose reserves "type")
  file: { path: String, name: String, size: Number, mime: String },
  readAt: Date,                                               // when the other side first saw it
}, { timestamps: true });
s.index({ licenceNo: 1, createdAt: 1 });
s.index({ from: 1, readAt: 1 });

export const ChatMessage = mongoose.models.ChatMessage || mongoose.model('ChatMessage', s);
