import { connectDB } from '@/lib/db';
import { audit } from '@/lib/audit';
import { requireRole } from '@/lib/session';
import { Licence } from '@/models/Licence';
import { Submission } from '@/models/Submission';
import { nextAckNo, SubType } from '@/lib/ack';
import { readPdf, savePdf, errorResponse, UserError } from '@/lib/files';
import { sendMail } from '@/lib/notify';
import { fmtTs } from '@/lib/format';

const TYPES = ['IC', 'EODC', 'DL', 'MS'];

export async function GET() {
  const s = await requireRole('importer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  await connectDB();
  const rows = await Submission.find({ iec: s.iec }).select('-filePath').sort({ createdAt: -1 }).lean();
  return Response.json({ rows });
}

// multipart: type, licenceNo, file, details(JSON). To answer an officer query pass replyTo=<ackNo> and text.
export async function POST(req: Request) {
  const s = await requireRole('importer');
  if (!s) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const fd = await req.formData();
    const buf = await readPdf(fd.get('file'), 'Certificate/document');
    await connectDB();
    const replyTo = fd.get('replyTo') ? String(fd.get('replyTo')) : null;

    if (replyTo) {
      const sub: any = await Submission.findOne({ ackNo: replyTo, iec: s.iec, status: 'query_raised' });
      if (!sub) throw new UserError('No open query for that acknowledgement', 404);
      sub.status = 'received';
      sub.reply = { text: String(fd.get('text') || ''), repliedOn: new Date(), filePath: await savePdf(buf, 'submissions', 'reply') };
      await sub.save();
      if (sub.type === 'EODC') await Licence.updateOne({ licenceNo: sub.licenceNo }, { stage: 'eodc_received' });
      await audit(s, 'reply_query', sub.ackNo, { licence: sub.licenceNo });
      return Response.json({ ackNo: sub.ackNo, status: sub.status });
    }

    const type = String(fd.get('type')), licenceNo = String(fd.get('licenceNo'));
    if (!TYPES.includes(type)) throw new UserError('Invalid document type');
    const lic: any = await Licence.findOne({ licenceNo, iec: s.iec }); // only against the importer's own licence
    if (!lic) throw new UserError('Licence not found', 404);
    if (lic.status === 'closed') throw new UserError('This licence is closed');
    if (type === 'IC' && lic.scheme !== 'EPCG') throw new UserError('Installation certificate applies to EPCG licences only');

    let details: any = {}; try { details = JSON.parse(String(fd.get('details') || '{}')); } catch {}
    if (type === 'IC' && (!details.certifiedBy || !details.certDate)) throw new UserError('Certified by and certificate date are required');
    if (type === 'EODC' && (!details.eodcNo || !details.eodcDate)) throw new UserError('EODC number and date are required');
    if (type === 'DL' && !details.dlRef) throw new UserError('Deficiency letter reference is required');

    const file = fd.get('file') as File;
    const ackNo = await nextAckNo(type as SubType);
    const sub: any = await Submission.create({
      ackNo, type, licenceNo, iec: s.iec, partyName: lic.partyName, details,
      filePath: await savePdf(buf, 'submissions', type.toLowerCase()), fileName: file.name, fileSize: file.size,
    });
    if (type === 'EODC') await Licence.updateOne({ _id: lic._id }, { stage: 'eodc_received' });
    await audit(s, 'submit_document', ackNo, { licence: licenceNo, type });
    await sendMail(null, `Acknowledgement ${ackNo}`, `Received on ${fmtTs(sub.createdAt)} against licence ${licenceNo}.`, s.iec);
    return Response.json({ ackNo, status: 'received', receivedAt: sub.createdAt }, { status: 201 });
  } catch (e) { return errorResponse(e); }
}
