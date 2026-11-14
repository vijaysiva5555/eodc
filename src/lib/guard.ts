import { redirect } from 'next/navigation';
import { getSession } from './session';
import { connectDB } from './db';

export async function needImporter() {
  const s = await getSession(); if (!s || s.role !== 'importer') redirect('/');
  await connectDB(); return s;
}
export async function needOfficer(allowChange = false) {
  const s = await getSession(); if (!s || s.role !== 'officer') redirect('/');
  if (s.mustChange && !allowChange) redirect('/officer/account');
  await connectDB();
  const { Officer } = await import('@/models/Officer');
  const o: any = await Officer.findOne({ userId: s.sub }).select('active role').lean();
  if (!o?.active) redirect('/');
  s.admin = o.role === 'admin' || o.role === 'superadmin';
  s.superadmin = o.role === 'superadmin';
  return s;
}
export async function needAdmin() {
  const s = await needOfficer(); if (!s.admin) redirect('/officer'); return s;
}
// The activity log is for the super admin only
export async function needSuperAdmin() {
  const s = await needOfficer(); if (!s.superadmin) redirect('/officer'); return s;
}
