import { getSession } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { ChatMessage } from '@/models/ChatMessage';
import { readStored, safeRel, mimeOf } from '@/lib/files';

// GET /api/files?p=<relative path>&dl=1
// Officers may open any stored file; an importer only files on its own licences, submissions and chats.
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const u = new URL(req.url).searchParams;
  const rel = safeRel(u.get('p') || '');
  if (!rel) return Response.json({ error: 'Bad path' }, { status: 400 });
  if (s.role === 'importer') {
    await connectDB();
    const own = (await Licence.exists({ iec: s.iec, 'attachments.path': rel })) ||
      (await Submission.exists({ iec: s.iec, $or: [{ filePath: rel }, { 'reply.filePath': rel }] })) ||
      (await ChatMessage.exists({ iec: s.iec, 'file.path': rel }));
    if (!own) return Response.json({ error: 'Not found' }, { status: 404 });
  }
  try {
    const buf = await readStored(rel);
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': mimeOf(rel), 'Content-Disposition': `${u.get('dl') ? 'attachment' : 'inline'}; filename="${rel.split('/').pop()}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch { return Response.json({ error: 'File not found' }, { status: 404 }); }
}
