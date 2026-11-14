/* eslint-disable no-console */
// Copies files saved in ./storage (before S3 was switched on) to S3, keeping the same relative path,
// so the paths already stored in the database keep working.
//   npm run upload-storage-to-s3
// Skips tmp/ (OCR uploads that were never saved) and files already in S3. Local files are not deleted;
// remove ./storage yourself once you have checked the app.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { LOCAL_DIR, putFile, usingS3 } from '../src/lib/storage';

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}

async function main() {
  if (!usingS3()) throw new Error('AWS_S3_BUCKET is not set in .env.local');
  const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  const prefix = (process.env.AWS_S3_PREFIX || '').replace(/^\/+|\/+$/g, '');
  const files = (await walk(LOCAL_DIR)).map((f) => path.relative(LOCAL_DIR, f).split(path.sep).join('/'))
    .filter((rel) => rel !== '.gitkeep' && !rel.startsWith('tmp/'));
  let copied = 0, skipped = 0;
  for (const rel of files) {
    const Key = [prefix, rel].filter(Boolean).join('/');
    const exists = await s3.send(new HeadObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key })).then(() => true, () => false);
    if (exists) { skipped++; console.log(`already in S3  ${Key}`); continue; }
    await putFile(rel, await readFile(path.join(LOCAL_DIR, rel)), rel.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    copied++; console.log(`copied         ${Key}`);
  }
  console.log(`\n${copied} copied, ${skipped} already there, bucket ${process.env.AWS_S3_BUCKET}.`);
}
main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
