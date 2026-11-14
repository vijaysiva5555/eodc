import { Counter } from '@/models/Counter';

const CODE = { IC: 'IC', EODC: 'EO', DL: 'DL', MS: 'MS' } as const;
export type SubType = keyof typeof CODE;

// EODC/IC/2026/01452 style acknowledgement numbers, sequence resets each year
export async function nextAckNo(type: SubType) {
  const year = new Date().getFullYear();
  const c = await Counter.findOneAndUpdate(
    { _id: `ack:${type}:${year}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }
  );
  return `EODC/${CODE[type]}/${year}/${String(c.seq).padStart(5, '0')}`;
}
