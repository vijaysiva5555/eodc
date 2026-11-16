import { AuditLog } from '@/models/AuditLog';
import type { Session } from './session';

type Who = { sub: string; name?: string; role: Session['role'] | 'system'; admin?: boolean; superadmin?: boolean };

// Officers are recorded with their access level, so the log shows officer / admin / superadmin.
const accessOf = (w: Who) => (w.role !== 'officer' ? w.role : w.superadmin ? 'superadmin' : w.admin ? 'admin' : 'officer');

// Records one activity. Never throws: a logging failure must not break the action itself.
export async function audit(who: Who, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    await AuditLog.create({ actor: who.sub, name: who.name, role: accessOf(who), action, target, meta });
  } catch (e) { console.error('audit log failed', e); }
}

export type AuditQuery = { who?: string; role?: string; action?: string; from?: string; to?: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// Mongo filter for the activity log page and its Excel export. Dates are IST calendar days.
export function auditFilter(q: AuditQuery) {
  const f: Record<string, unknown> = {};
  const who = (q.who || '').replace(/[^\w .@-]/g, '').trim();
  if (who) { const r = new RegExp(who, 'i'); f.$or = [{ actor: r }, { name: r }, { target: r }]; }
  if (q.role && ['importer', 'officer', 'admin', 'superadmin', 'system'].includes(q.role)) f.role = q.role;
  if (q.action && ACTION_LABEL[q.action]) f.action = q.action;
  const at: Record<string, Date> = {};
  if (q.from && ISO.test(q.from)) at.$gte = new Date(`${q.from}T00:00:00+05:30`);
  if (q.to && ISO.test(q.to)) at.$lte = new Date(`${q.to}T23:59:59.999+05:30`);
  if (Object.keys(at).length) f.at = at;
  return f;
}
// "resetPassword: true, role: admin" style summary of the extra details stored with an activity
export const metaText = (m?: Record<string, unknown>) =>
  m ? Object.entries(m).filter(([, v]) => v !== undefined && v !== false && v !== '').map(([k, v]) => (v === true ? k : `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)).join(', ') : '';

// Human-readable labels for the activity log page
export const ACTION_LABEL: Record<string, string> = {
  login: 'Logged in', login_failed: 'Failed login', account_locked: 'Account locked after failed logins', logout: 'Logged out',
  importer_login: 'Importer logged in (OTP)', importer_register: 'Importer registered', change_password: 'Changed password',
  create_user: 'Created user', update_user: 'Changed user', create_superadmin: 'Super admin account set up',
  add_licence: 'Added licence', correct_licence: 'Corrected licence details', add_bond: 'Added bond', add_bg: 'Added BG', update_bg: 'Updated BG bank contact',
  upload_alert: 'Uploaded alert letter', upload_notice: 'Uploaded simple notice',
  adjudication_scn: 'Recorded show cause notice', adjudication_ph: 'Recorded PH notice', adjudication_oio: 'Recorded Order-in-Original',
  submit_document: 'Importer submitted document', reply_query: 'Importer replied to query',
  assign: 'Assigned inbox items', raise_query: 'Raised query', action_over: 'Marked action over',
  alert_reminder: 'Sent reminder notice', alert_flag_scn: 'Flagged for SCN',
  chat_message: 'Sent chat message',
};
