import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Officer } from '@/models/Officer';
import { tempPassword } from '@/lib/password';
import { audit } from '@/lib/audit';

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: 'Admin only' }, { status: 403 });
  await connectDB();
  return Response.json({ rows: await Officer.find().select('-passwordHash').sort({ name: 1 }).lean() });
}

const Body = z.object({ userId: z.string().regex(/^[a-z0-9._-]{3,30}$/, 'User ID: 3-30 lowercase letters, digits, . _ -'), name: z.string().min(2), designation: z.enum(['Superintendent', 'DA', 'Admin']), role: z.enum(['admin', 'officer']) });

// Super admin creates admins and officers; an admin creates officers only.
export async function POST(req: Request) {
  const s = await requireAdmin();
  if (!s) return Response.json({ error: 'Admin only' }, { status: 403 });
  const p = Body.safeParse(await req.json());
  if (!p.success) return Response.json({ error: p.error.issues[0].message }, { status: 400 });
  if (p.data.role === 'admin' && !s.superadmin) return Response.json({ error: 'Only the super admin can create admin accounts' }, { status: 403 });
  await connectDB();
  if (await Officer.exists({ userId: p.data.userId })) return Response.json({ error: 'User ID already exists' }, { status: 409 });
  const pw = tempPassword();
  await Officer.create({ ...p.data, passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: true });
  await audit(s, 'create_user', p.data.userId, { role: p.data.role, designation: p.data.designation });
  return Response.json({ userId: p.data.userId, tempPassword: pw }, { status: 201 }); // shown once
}
