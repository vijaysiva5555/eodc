/* eslint-disable no-console */
// Creates the super admin account, or resets its password if it already exists.
//   npm run create-superadmin                      -> user ID "superadmin", name "Super Admin"
//   npm run create-superadmin -- <userId> "<Name>"
// A temporary password is printed once; it must be changed at first login.
// Running it again for an existing user ID resets the password (use this if the super admin password is lost),
// and turns an existing admin/officer account with that user ID into the super admin.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB } from '../src/lib/db';
import { Officer } from '../src/models/Officer';
import { tempPassword } from '../src/lib/password';
import { audit } from '../src/lib/audit';

async function main() {
  const userId = (process.argv[2] || 'superadmin').toLowerCase();
  const name = process.argv[3] || 'Super Admin';
  if (!/^[a-z0-9._-]{3,30}$/.test(userId)) throw new Error('User ID: 3-30 lowercase letters, digits, . _ -');
  await connectDB();
  const pw = tempPassword();
  const passwordHash = await bcrypt.hash(pw, 10);
  const existing: any = await Officer.findOne({ userId });
  if (existing) {
    Object.assign(existing, { role: 'superadmin', designation: 'Super Admin', active: true, passwordHash, mustChangePassword: true, failedAttempts: 0, lockedUntil: undefined });
    await existing.save();
  } else {
    await Officer.create({ userId, name, designation: 'Super Admin', role: 'superadmin', passwordHash, mustChangePassword: true });
  }
  await audit({ sub: 'system', name: 'create-superadmin script', role: 'system' }, 'create_superadmin', userId, { reset: !!existing });
  console.log(`\nSuper admin ${existing ? 'password reset' : 'created'}.`);
  console.log(`  User ID:            ${userId}`);
  console.log(`  Temporary password: ${pw}`);
  console.log('Log in on the Officer tab. You will be asked to set a new password. This password is not shown again.\n');
}

main().catch((e) => { console.error(e.message || e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
