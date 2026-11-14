# EODC Portal

Next.js 14 (App Router, TypeScript) + MongoDB (Mongoose). Covers all 22 screens in the mock-up deck.

## Run
```bash
npm install
cp .env.example .env.local      # fill MONGODB_URI, MONGODB_DB, SESSION_SECRET
npm run seed                    # dummy data from the deck (add -- --reset to wipe and reload)
npm run dev
```
Logins (dev):
- Importer: IEC `ABCDE1234F`; the OTP is printed in the server log and shown on the login page when NODE_ENV is not production.
- Importer registration test: `PQRST6789K`, e-mail `info@meerapharma.in`, mobile `9800000001`.
- Officer: `rsharma` / `Officer@123` (admin; also `akhan`, `pnair`, `siyer`).
- Super admin (seeded): `superadmin` / `Officer@123`. On an existing database run `npm run create-superadmin` instead (see Roles).

## Screens
| Deck | Route |
|---|---|
| Importer 1 login, register | `/`, `/register` |
| Importer 2 home | `/importer` |
| Importer 3 licence list | `/importer/epcg`, `/importer/deec` |
| Importer 4 licence details | `/importer/licence/[no]` |
| Importer 5 submit (IC, EODC, DL reply, other) | `/importer/licence/[no]/submit/[ic|eodc|dl|ms]` |
| Importer 6 submissions and queries | `/importer/submissions` |
| Officer 1 home | `/officer` |
| Officer 2-3 active / closed lists | `/officer/epcg`, `/officer/deec` (`?tab=closed`) |
| Officer 4-5 add licence, OCR, check, save | `/officer/licence/new` |
| Officer 6-11 licence page, ten tabs | `/officer/licence/[no]?tab=details|bond|bg|attachments|ic|eodc|dl|alerts|notice|adjudication` |
| Officer 12 inbox | `/officer/inbox/[ic|eodc|dl|ms]` |
| Officer 13-14 take action / EODC closes licence | `/officer/inbox/[type]/[id]` |
| Officer 15 alerts and defaulters | `/officer/alerts?tab=ic|eo|bg|block` |
| Officer 16 reports (8 reports, Excel) | `/officer/reports` |
| Not in the deck: user management (admin, super admin), activity log (super admin only), change password | `/officer/admin/users`, `/officer/admin/audit`, `/officer/account` |

## Business rules (src/lib/rules.ts) — confirm these
Derived from the sample data in the deck; the deck does not state them:
- EPCG EO period = 6 years from licence date; EO = 6 x duty saved; first block due 4 years from licence date.
- IC due = 6 months after bond date. DEEC/AA EO period 18 months is an assumption.
- A licence is a defaulter when its EO period has ended with no EODC received (stage updates when officer pages load).
- EODC "Action over" closes the licence automatically and marks bonds Cancelled. IC "Action over" sets stage to IC received.
- Installation certificate is offered for EPCG licences only.

## OCR (src/lib/ocr.ts)
Reads the text layer of the three PDFs (unpdf) and extracts fields with regular expressions, flagging anything missing, malformed or inconsistent (for example IEC differs between licence and e-Bond) as "Check". The patterns are written from the field names in the deck: tune them against real DGFT, ICEGATE and e-BG PDFs. Scanned PDFs have no text layer; plug an image OCR engine into `runOcr` for those.

## File storage (S3)
Every uploaded PDF (licence, e-Bond, e-BG, party submissions and replies, alert/notice letters, SCN/PH/OIO) is stored in S3 at `<AWS_S3_PREFIX>/<path>`, for example `import/licences/0711019337/licence_….pdf`, `import/submissions/ic_….pdf`. Settings in `.env.local`: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_PREFIX`. Objects are private and encrypted (SSE-S3); users open them through `/api/files`, which checks the login (importers see only their own files). Without `AWS_S3_BUCKET` the app keeps files in `./storage` (local dev). Files saved locally before S3 was switched on are still read from `./storage`; copy them with `npm run upload-storage-to-s3`.

## Before production
- Rotate the MongoDB root password; create an app user limited to the `eodc` database; restrict network access.
- Replace the OTP and e-mail stubs (`src/lib/otp.ts`, `src/lib/notify.ts`) with real gateways.
- Uploads are in S3 (see File storage). Add an S3 lifecycle rule that deletes `<prefix>/tmp/` objects after 1 day: they are OCR uploads that were never saved.
- Add rate limiting on login; set a strong SESSION_SECRET.
- User management: temporary password shown once, forced change at first login; edit designation, deactivate (immediate), reset password, unlock. Five wrong passwords lock an account for 15 minutes. Users are never deleted.

## Roles
| Role | Can do |
|---|---|
| Super admin | Everything an admin can, plus create and manage **admin** accounts, and the **Activity log** (`/officer/admin/audit`, filters, Excel export). Only role that sees the log. |
| Admin | Officer work, plus create and manage **officer** accounts. Cannot change admin or super admin accounts. |
| Officer | Day-to-day work (licences, inbox, alerts, reports). |

The super admin is not created from the screen. Create it, or reset its lost password, with:
```bash
npm run create-superadmin                         # user ID "superadmin"
npm run create-superadmin -- <userId> "<Name>"    # or choose the user ID and name
```
It prints a temporary password once; the super admin must set a new one at first login.

The Activity log records logins (and failed logins and lockouts), logouts, importer registration, OTP logins, submissions and query replies, licence adds and corrections, bond/BG adds, letter uploads, adjudication steps, inbox assignments, actions and queries, alert actions, and user and password changes.
- Role rules: all non-admin officers currently have the same rights. The deck does not say what Superintendent and DA may each do.
