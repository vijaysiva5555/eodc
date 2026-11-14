import crypto from 'crypto';
export const policyError = (pw: string) =>
  pw.length < 10 ? 'Password must be at least 10 characters' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'Password must contain letters and digits' : null;
export const tempPassword = () => crypto.randomBytes(9).toString('base64url') + 'a1'; // shown once to the admin
