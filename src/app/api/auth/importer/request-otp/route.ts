import { NextResponse } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Importer } from '@/models/Importer';
import { Otp } from '@/models/Otp';
import { generateOtp, hashOtp, sendOtp, mask } from '@/lib/otp';

export async function POST(req: Request) {
  const p = z.object({ iec: z.string().regex(/^[A-Za-z0-9]{10}$/) }).safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: 'Enter a valid 10-character IEC' }, { status: 400 });
  const iec = p.data.iec.toUpperCase();
  await connectDB();
  const imp = await Importer.findOne({ iec });
  if (!imp) return NextResponse.json({ error: 'IEC not registered. Register with your IEC and e-Bond contact details.' }, { status: 404 });

  if (!imp.registered) return NextResponse.json({ error: 'Register first with your IEC and the e-Bond contact details.' }, { status: 403 });

  const recent = await Otp.countDocuments({ iec, expiresAt: { $gt: new Date(Date.now() + 4 * 60_000) } });
  if (recent >= 3) return NextResponse.json({ error: 'Too many OTP requests. Try again in a few minutes.' }, { status: 429 });

  const otp = generateOtp();
  await Otp.create({ iec, hash: hashOtp(iec, otp), expiresAt: new Date(Date.now() + 5 * 60_000) });
  await sendOtp(imp.mobile, imp.email, otp);
  return NextResponse.json({
    message: `OTP sent to mobile ${mask.mobile(imp.mobile)} and ${mask.email(imp.email)}`,
    ...(process.env.NODE_ENV !== 'production' && { devOtp: otp }),
  });
}
