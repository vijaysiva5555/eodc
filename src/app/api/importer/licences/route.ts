import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';

// GET /api/importer/licences?scheme=EPCG&status=active&q=0331
export async function GET(req: Request) {
  const s = await requireRole('importer');
  if (!s) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const filter: Record<string, unknown> = { iec: s.iec };
  if (u.get('scheme')) filter.scheme = u.get('scheme');
  if (u.get('status')) filter.status = u.get('status');
  const q = u.get('q');
  if (q) filter.$or = [{ licenceNo: new RegExp(q.replace(/[^\w/-]/g, ''), 'i') }, { 'bonds.bondNo': new RegExp(q.replace(/[^\w/-]/g, ''), 'i') }];
  await connectDB();
  const rows = await Licence.find(filter).select('-attachments.path -letters').sort({ licenceDate: -1 }).lean();
  return NextResponse.json({ rows });
}
