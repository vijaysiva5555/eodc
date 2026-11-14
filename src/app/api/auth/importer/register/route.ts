import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { Importer } from '@/models/Importer';

// "Register with your IEC and the e-Bond contact details": must match what was read from the e-Bond.
const norm = (m: string) => m.replace(/\D/g, '').slice(-10);
export async function POST(req: Request) {
  const p = z.object({ iec: z.string().length(10), email: z.string().email(), mobile: z.string().min(10) }).safeParse(await req.json());
  if (!p.success) return Response.json({ error: 'Enter IEC, e-mail and mobile as given on the e-Bond' }, { status: 400 });
  await connectDB();
  const imp: any = await Importer.findOne({ iec: p.data.iec.toUpperCase() });
  if (!imp || imp.email.toLowerCase() !== p.data.email.toLowerCase() || norm(imp.mobile) !== norm(p.data.mobile))
    return Response.json({ error: 'These details do not match our records. Use the contact details on your e-Bond.' }, { status: 404 });
  imp.registered = true; await imp.save();
  await audit({ sub: imp.iec, name: imp.name, role: 'importer' }, 'importer_register');
  return Response.json({ ok: true, message: 'Registered. Log in with your IEC and OTP.' });
}
