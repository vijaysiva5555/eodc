import path from 'path';
import crypto from 'crypto';
import { getDocumentProxy, extractText } from 'unpdf';
import { putFile, getFile, moveStoredFile } from './storage';

export const MAX_BYTES = 10 * 1024 * 1024;
export class UserError extends Error { constructor(m: string, public status = 400) { super(m); } }

export async function pdfInfo(buf: Buffer) {
  try {
    const doc = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(doc, { mergePages: true });
    return { pages: r.totalPages, text: String(r.text || '') };
  } catch { return { pages: 0, text: '' }; }
}

export async function readPdf(file: FormDataEntryValue | null, label = 'File'): Promise<Buffer> {
  if (!(file instanceof File) || file.size === 0) throw new UserError(`${label} is required`);
  if (file.size > MAX_BYTES) throw new UserError(`${label} is larger than 10 MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.subarray(0, 5).toString() !== '%PDF-') throw new UserError(`${label} must be a PDF`);
  return buf;
}

// Chat attachments: PDF or image, checked by content (not by file name), max 10 MB
const KINDS = [
  { mime: 'application/pdf', ext: 'pdf', magic: (b: Buffer) => b.subarray(0, 5).toString() === '%PDF-' },
  { mime: 'image/png', ext: 'png', magic: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', magic: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];
export async function readAttachment(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new UserError('Attachment is larger than 10 MB');
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.magic(buf));
  if (!kind) throw new UserError('Attach a PDF, JPG or PNG file');
  return { buf, kind, name: file.name.replace(/[^\w.\- ()]/g, '_').slice(0, 120), size: file.size };
}
export async function saveAttachment(a: NonNullable<Awaited<ReturnType<typeof readAttachment>>>, subdir: string) {
  const rel = path.posix.join(subdir, `chat_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.${a.kind.ext}`);
  await putFile(rel, a.buf, a.kind.mime);
  return rel;
}
export const mimeOf = (rel: string) => (rel.endsWith('.png') ? 'image/png' : /\.jpe?g$/.test(rel) ? 'image/jpeg' : 'application/pdf');

// Saves an uploaded PDF (S3 when configured, see lib/storage.ts) and returns its relative path for the database.
export async function savePdf(buf: Buffer, subdir: string, prefix = 'f') {
  const rel = path.posix.join(subdir, `${prefix}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.pdf`);
  await putFile(rel, buf);
  return rel;
}
export const moveFile = (fromRel: string, toRel: string) => moveStoredFile(fromRel, toRel);
export const readStored = (rel: string) => getFile(rel);
export const safeRel = (rel: string) => { const n = path.posix.normalize(rel); return n.startsWith('..') || n.startsWith('/') ? null : n; };

export function errorResponse(e: unknown) {
  if (e instanceof UserError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Something went wrong. Try again.' }, { status: 500 });
}
