import mongoose, { Schema } from 'mongoose';
const s = new Schema({ _id: String, seq: { type: Number, default: 0 } });
export const Counter = mongoose.models.Counter || mongoose.model('Counter', s);
