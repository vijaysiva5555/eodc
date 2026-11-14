import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { Importer } from '@/models/Importer';
import { Otp } from '@/models/Otp';
import { hashOtp } from '@/lib/otp';
import { createSession } from '@/lib/session';

export async function POST(req: Request) {
  const p = z.object({ iec: z.string().length(10), otp: z.string().length(6) }).safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const iec = p.data.iec.toUpperCase();
  await connectDB();
  const rec = await Otp.findOne({ iec, expiresAt: { $gt: new Date() } }).sort({ expiresAt: -1 });
  if (!rec || rec.attempts >= 5) return NextResponse.json({ error: 'OTP expired. Request a new one.' }, { status: 400 });
  if (rec.hash !== hashOtp(iec, p.data.otp)) {
    await Otp.updateOne({ _id: rec._id }, { $inc: { attempts: 1 } });
    return NextResponse.json({ error: 'Incorrect OTP' }, { status: 401 });
  }
  await Otp.deleteMany({ iec });
  const imp = await Importer.findOne({ iec, registered: true });
  if (!imp) return NextResponse.json({ error: 'Not registered' }, { status: 403 });
  await createSession({ role: 'importer', sub: iec, iec, name: imp.name });
  await audit({ sub: iec, name: imp.name, role: 'importer' }, 'importer_login');
  return NextResponse.json({ ok: true, redirect: '/importer' });
}
