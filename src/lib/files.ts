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
