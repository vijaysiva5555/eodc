import { z } from 'zod';
import { audit } from '@/lib/audit';
import { connectDB } from '@/lib/db';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { readPdf, savePdf, errorResponse, UserError } from '@/lib/files';

const Body = z.object({ kind: z.enum(['alert', 'notice']), title: z.string().min(2), letterNo: z.string().optional().default(''), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

// Upload asks for: title, letter no., date and PDF
export async function POST(req: Request, { params }: { params: { no: string } }) {
  const s = await requireRole('officer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const fd = await req.formData();
    const p = Body.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')));
    if (!p.success) throw new UserError(p.error.issues.map((i) => `${i.path}: ${i.message}`).join('; '));
    if (p.data.kind === 'notice' && !p.data.letterNo) throw new UserError('Letter no. is required for a notice');
    const buf = await readPdf(fd.get('file'), 'PDF');
    await connectDB();
    const lic: any = await Licence.findOne({ licenceNo: params.no });
    if (!lic) throw new UserError('Licence not found', 404);
    const rel = await savePdf(buf, `licences/${params.no}`, p.data.kind);
    lic.letters.push({ ...p.data, date: new Date(p.data.date), path: rel, uploadedBy: s.name });
    await lic.save();
    await audit(s, `upload_${p.data.kind}`, params.no, { title: p.data.title, letterNo: p.data.letterNo });
    return Response.json({ ok: true }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
