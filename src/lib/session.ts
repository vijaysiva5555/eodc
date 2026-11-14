import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { connectDB } from './db';
import { Officer } from '@/models/Officer';

// admin: may manage users (true for admin and superadmin). superadmin: may also manage admins and read the activity log.
export type Session = { role: 'importer' | 'officer'; sub: string; name: string; iec?: string; admin?: boolean; superadmin?: boolean; mustChange?: boolean };
const COOKIE = 'eodc_session';
const key = () => new TextEncoder().encode(process.env.SESSION_SECRET || '');

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('8h')
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function getSession(): Promise<Session | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, key());
    return payload as unknown as Session;
  } catch { return null; }
}

export function clearSession() { cookies().delete(COOKIE); }

// An officer on a temporary password may only reach the change-password endpoint (allowChange).
export async function requireRole(role: Session['role'], allowChange = false) {
  const s = await getSession();
  if (!s || s.role !== role) return null;
  if (s.mustChange && !allowChange) return null;
  if (role === 'officer') { // deactivated officers lose access immediately, not when the cookie expires
    await connectDB();
    const o: any = await Officer.findOne({ userId: s.sub }).select('active role').lean();
    if (!o?.active) return null;
    s.admin = o.role === 'admin' || o.role === 'superadmin';
    s.superadmin = o.role === 'superadmin';
  }
  return s;
}
export async function requireAdmin() {
  const s = await requireRole('officer');
  return s?.admin ? s : null;
}
export async function requireSuperAdmin() {
  const s = await requireRole('officer');
  return s?.superadmin ? s : null;
}
