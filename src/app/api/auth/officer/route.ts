import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { Officer } from '@/models/Officer';
import { createSession } from '@/lib/session';
import { audit } from '@/lib/audit';

const MAX_FAILS = 5, LOCK_MIN = 15;
export async function POST(req: Request) {
  const p = z.object({ userId: z.string().min(2), password: z.string().min(1) }).safeParse(await req.json());
  if (!p.success) return Response.json({ error: 'Invalid input' }, { status: 400 });
  await connectDB();
  const userId = p.data.userId.toLowerCase();
  const o: any = await Officer.findOne({ userId, active: true });
  if (o?.lockedUntil && o.lockedUntil > new Date()) return Response.json({ error: `Account locked. Try again after ${LOCK_MIN} minutes or ask an admin to reset the password.` }, { status: 423 });
  const ok = o && (await bcrypt.compare(p.data.password, o.passwordHash));
  if (!ok) {
    let locked = false;
    if (o) { o.failedAttempts += 1; if (o.failedAttempts >= MAX_FAILS) { o.lockedUntil = new Date(Date.now() + LOCK_MIN * 60_000); o.failedAttempts = 0; locked = true; } await o.save(); }
    await audit({ sub: userId, name: o?.name, role: 'officer' }, locked ? 'account_locked' : 'login_failed', undefined, o ? undefined : { unknownUser: true });
    return Response.json({ error: 'Wrong user ID or password' }, { status: 401 });
  }
  o.failedAttempts = 0; o.lockedUntil = undefined; o.lastLoginAt = new Date(); await o.save();
  const short = o.designation === 'Superintendent' ? 'Supdt.' : o.designation;
  const flags = { admin: o.role === 'admin' || o.role === 'superadmin', superadmin: o.role === 'superadmin' };
  const session = { role: 'officer' as const, sub: o.userId, name: `${o.name}, ${short}`, ...flags, mustChange: o.mustChangePassword };
  await createSession(session);
  await audit(session, 'login');
  return Response.json({ ok: true, redirect: o.mustChangePassword ? '/officer/account' : '/officer' });
}
