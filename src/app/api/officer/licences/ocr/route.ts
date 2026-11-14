import { requireRole } from '@/lib/session';
import { connectDB } from '@/lib/db';
import { Licence } from '@/models/Licence';
import { Importer } from '@/models/Importer';
import { readPdf, savePdf, errorResponse } from '@/lib/files';
import { runOcr } from '@/lib/ocr';
import crypto from 'crypto';

// multipart: licence, ebond, ebg(optional). Files go to tmp/<token>/ (in S3 when configured) until the officer saves,
// then they are moved to licences/<licence no.>/.
export async function POST(req: Request) {
  if (!(await requireRole('officer'))) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  try {
    const fd = await req.formData();
    const licence = await readPdf(fd.get('licence'), 'Licence PDF');
    const ebond = await readPdf(fd.get('ebond'), 'e-Bond PDF');
    const hasBg = fd.get('ebg') instanceof File && (fd.get('ebg') as File).size > 0;
    const ebg = hasBg ? await readPdf(fd.get('ebg'), 'e-BG PDF') : undefined;

    const token = crypto.randomBytes(8).toString('hex');
    const dir = `tmp/${token}`;
    const paths = {
      licence: await savePdf(licence, dir, 'licence'),
      ebond: await savePdf(ebond, dir, 'ebond'),
      ebg: ebg ? await savePdf(ebg, dir, 'ebg') : null,
    };
    const result = await runOcr({ licence, ebond, ebg });
    await connectDB();
    const no = result.fields.find((f) => f.key === 'licenceNo')?.value;
    const dup = no ? await Licence.findOne({ licenceNo: no }).select('licenceNo scheme status partyName').lean() : null;
    // The e-Bond does not carry the importer's e-mail / mobile. If this IEC is already known, use its contact details.
    const iec = result.fields.find((f) => f.key === 'iec')?.value;
    const imp: any = iec ? await Importer.findOne({ iec }).select('email mobile address').lean() : null;
    if (imp) for (const f of result.fields) {
      if (!['email', 'mobile', 'address'].includes(f.key) || f.value || !imp[f.key]) continue;
      f.value = f.key === 'mobile' ? String(imp.mobile).replace(/\D/g, '').slice(-10) : String(imp[f.key]).trim();
      f.status = 'OK'; f.note = 'From the existing importer record';
    }
    return Response.json({ token, paths, ...result, duplicate: dup });
  } catch (e) { return errorResponse(e); }
}
