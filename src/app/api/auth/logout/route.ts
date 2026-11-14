import { NextResponse } from 'next/server';
import { clearSession, getSession } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { audit } from '@/lib/audit';

export async function POST() {
  const s = await getSession();
  if (s) { await connectDB(); await audit(s, 'logout'); }
  clearSession();
  return NextResponse.json({ ok: true });
}
