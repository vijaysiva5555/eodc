import { connectDB } from '@/lib/db';
import { requireRole, type Session } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { ChatMessage } from '@/models/ChatMessage';
import { readAttachment, saveAttachment, errorResponse, UserError } from '@/lib/files';
import { audit } from '@/lib/audit';
import { sendMail } from '@/lib/notify';

const MAX_TEXT = 4000;

// The importer that owns the licence, or any officer, may read and write the licence's conversation.
async function viewer(no: string): Promise<{ s: Session; lic: any } | null> {
  const s = (await requireRole('officer')) || (await requireRole('importer'));
  if (!s) return null;
  await connectDB();
  const lic: any = await Licence.findOne({ licenceNo: no, ...(s.role === 'importer' && { iec: s.iec }) }).select('licenceNo iec scheme status partyName').lean();
  return lic ? { s, lic } : null;
}

const view = (m: any, me: Session['role']) => ({
  id: String(m._id), from: m.from, mine: m.from === me, senderName: m.senderName, text: m.text, at: m.createdAt, readAt: m.readAt || null,
  file: m.file?.path ? { url: `/api/files?p=${encodeURIComponent(m.file.path)}`, name: m.file.name, size: m.file.size, mime: m.file.mime } : null,
});

// GET /api/chat/<licenceNo>?after=<ISO time>  -> messages (all, or only newer ones). Marks the other side's messages as read.
export async function GET(req: Request, { params }: { params: { no: string } }) {
  const v = await viewer(params.no);
  if (!v) return Response.json({ error: 'Not found' }, { status: 404 });
  const after = new URL(req.url).searchParams.get('after');
  const f: any = { licenceNo: v.lic.licenceNo };
  if (after && !isNaN(+new Date(after))) f.createdAt = { $gt: new Date(after) };
  const rows: any[] = await ChatMessage.find(f).sort({ createdAt: 1 }).limit(500).lean();
  const other = v.s.role === 'importer' ? 'officer' : 'importer';
  await ChatMessage.updateMany({ licenceNo: v.lic.licenceNo, from: other, readAt: null }, { readAt: new Date() });
  // the other side reads a whole conversation at once, so "seen up to" the newest of my messages they have read
  const seen: any = await ChatMessage.findOne({ licenceNo: v.lic.licenceNo, from: v.s.role, readAt: { $ne: null } }).sort({ createdAt: -1 }).select('createdAt').lean();
  return Response.json({ messages: rows.map((m) => view(m, v.s.role)), canSend: v.lic.status === 'active', seenUntil: seen?.createdAt || null });
}

// POST multipart: text, file (optional PDF/JPG/PNG)
export async function POST(req: Request, { params }: { params: { no: string } }) {
  const v = await viewer(params.no);
  if (!v) return Response.json({ error: 'Not found' }, { status: 404 });
  try {
    if (v.lic.status !== 'active') throw new UserError('This licence is closed. The conversation is read-only.', 403);
    const fd = await req.formData();
    const text = String(fd.get('text') || '').trim();
    const att = await readAttachment(fd.get('file'));
    if (!text && !att) throw new UserError('Write a message or attach a file');
    if (text.length > MAX_TEXT) throw new UserError(`Keep the message under ${MAX_TEXT} characters`);
    const file = att ? { path: await saveAttachment(att, `chat/${v.lic.licenceNo}`), name: att.name, size: att.size, mime: att.kind.mime } : undefined;
    const m: any = await ChatMessage.create({
      licenceNo: v.lic.licenceNo, iec: v.lic.iec, from: v.s.role, senderId: v.s.sub, senderName: v.s.role === 'importer' ? v.lic.partyName : v.s.name, text, file,
    });
    await audit(v.s, 'chat_message', v.lic.licenceNo, { attachment: att ? att.name : undefined });
    if (v.s.role === 'officer') await sendMail(null, `New message on licence ${v.lic.licenceNo}`, 'The EODC cell has sent you a message. Log in to the EODC Portal to read and reply.', v.lic.iec);
    return Response.json({ message: view(m.toObject(), v.s.role) }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
