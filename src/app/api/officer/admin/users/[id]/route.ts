import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { Officer } from '@/models/Officer';
import { tempPassword } from '@/lib/password';
import { audit } from '@/lib/audit';

const Body = z.object({ name: z.string().min(2).optional(), designation: z.enum(['Superintendent', 'DA', 'Admin']).optional(), role: z.enum(['admin', 'officer']).optional(), active: z.boolean().optional(), resetPassword: z.boolean().optional(), unlock: z.boolean().optional() });

// Officers are never deleted: their names are on actioned items. Deactivate instead.
// Super admin: manages admins and officers. Admin: manages officers only (and may rename themself).
// Super admin accounts are not managed here: use `npm run create-superadmin`.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const s = await requireAdmin();
  if (!s) return Response.json({ error: 'Admin only' }, { status: 403 });
  const p = Body.safeParse(await req.json());
  if (!p.success) return Response.json({ error: p.error.issues[0].message }, { status: 400 });
  await connectDB();
  const o: any = await Officer.findOne({ userId: params.id });
  if (!o) return Response.json({ error: 'User not found' }, { status: 404 });
  const d = p.data;
  const self = o.userId === s.sub;
  if (o.role === 'superadmin') return Response.json({ error: 'Super admin accounts are managed with the create-superadmin script. Change your own password under Account.' }, { status: 403 });
  if (!s.superadmin && (d.role === 'admin' || (o.role === 'admin' && !(self && Object.keys(d).every((k) => k === 'name')))))
    return Response.json({ error: 'Only the super admin can create or change admin accounts' }, { status: 403 });
  if (self && (d.active === false || d.role === 'officer')) return Response.json({ error: 'You cannot deactivate or demote your own account' }, { status: 400 });
  if (d.name) o.name = d.name; if (d.designation) o.designation = d.designation; if (d.role) o.role = d.role;
  if (d.active !== undefined) o.active = d.active;
  if (d.unlock) { o.lockedUntil = undefined; o.failedAttempts = 0; }
  let temp: string | undefined;
  if (d.resetPassword) { temp = tempPassword(); o.passwordHash = await bcrypt.hash(temp, 10); o.mustChangePassword = true; o.lockedUntil = undefined; o.failedAttempts = 0; }
  await o.save();
  await audit(s, 'update_user', o.userId, { ...d, resetPassword: !!d.resetPassword });
  return Response.json({ ok: true, tempPassword: temp });
}
