import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { requireRole, createSession } from '@/lib/session';
import { Officer } from '@/models/Officer';
import { audit } from '@/lib/audit';
import { policyError } from '@/lib/password';

export async function POST(req: Request) {
  const s = await requireRole('officer', true);
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const p = z.object({ current: z.string().min(1), next: z.string() }).safeParse(await req.json());
  if (!p.success) return Response.json({ error: 'Invalid input' }, { status: 400 });
  const bad = policyError(p.data.next); if (bad) return Response.json({ error: bad }, { status: 400 });
  await connectDB();
  const o: any = await Officer.findOne({ userId: s.sub });
  if (!o || !(await bcrypt.compare(p.data.current, o.passwordHash))) return Response.json({ error: 'Current password is wrong' }, { status: 401 });
  if (p.data.current === p.data.next) return Response.json({ error: 'Choose a different password' }, { status: 400 });
  o.passwordHash = await bcrypt.hash(p.data.next, 10); o.mustChangePassword = false; await o.save();
  await createSession({ ...s, mustChange: false });
  await audit(s, 'change_password');
  return Response.json({ ok: true });
}
