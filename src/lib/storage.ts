// File storage for every uploaded PDF (licence / e-Bond / e-BG, party submissions, replies, letters, SCN/PH/OIO).
// With AWS_S3_BUCKET set, files live in S3 under AWS_S3_PREFIX/<relative path>; the database keeps only the
// relative path (e.g. "licences/0711019337/licence_123.pdf"). Without a bucket, files stay in ./storage (local dev).
// Files are never public: the app streams them through /api/files after checking who is asking.
import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { mkdir, writeFile, readFile, rename, unlink } from 'fs/promises';
import path from 'path';

export const LOCAL_DIR = path.join(process.cwd(), 'storage');

// read lazily so scripts that load .env.local after their imports still see the settings
const cfg = () => ({ bucket: process.env.AWS_S3_BUCKET || '', prefix: (process.env.AWS_S3_PREFIX || '').replace(/^\/+|\/+$/g, ''), region: process.env.AWS_REGION || 'us-east-1' });
export const usingS3 = () => !!cfg().bucket;
const key = (rel: string) => [cfg().prefix, rel].filter(Boolean).join('/');

let client: S3Client | null = null;
const s3 = () => (client ||= new S3Client({ region: cfg().region })); // credentials from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (or an IAM role)

const local = (rel: string) => path.join(LOCAL_DIR, rel);
const isMissing = (e: any) => e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404 || e?.code === 'ENOENT';

export async function putFile(rel: string, body: Buffer, contentType = 'application/pdf') {
  if (!usingS3()) { await mkdir(path.dirname(local(rel)), { recursive: true }); await writeFile(local(rel), body); return; }
  await s3().send(new PutObjectCommand({ Bucket: cfg().bucket, Key: key(rel), Body: body, ContentType: contentType, ServerSideEncryption: 'AES256' }));
}

export async function getFile(rel: string): Promise<Buffer> {
  if (usingS3()) {
    try {
      const r = await s3().send(new GetObjectCommand({ Bucket: cfg().bucket, Key: key(rel) }));
      return Buffer.from(await r.Body!.transformToByteArray());
    } catch (e) {
      if (!isMissing(e)) throw e; // fall through: a file saved on this server before S3 was switched on
    }
  }
  return readFile(local(rel));
}

export async function moveStoredFile(fromRel: string, toRel: string) {
  if (!usingS3()) { await mkdir(path.dirname(local(toRel)), { recursive: true }); await rename(local(fromRel), local(toRel)); return; }
  const { bucket } = cfg();
  await s3().send(new CopyObjectCommand({ Bucket: bucket, CopySource: encodeURI(`${bucket}/${key(fromRel)}`), Key: key(toRel), ServerSideEncryption: 'AES256' }));
  await s3().send(new DeleteObjectCommand({ Bucket: bucket, Key: key(fromRel) }));
}

export async function deleteFile(rel: string) {
  if (!usingS3()) { await unlink(local(rel)).catch(() => undefined); return; }
  await s3().send(new DeleteObjectCommand({ Bucket: cfg().bucket, Key: key(rel) }));
}
