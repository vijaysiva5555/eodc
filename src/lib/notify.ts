import { Importer } from '@/models/Importer';
import { connectDB } from './db';

// TODO: connect an SMTP / e-mail service. For now messages are logged on the server.
export async function sendMail(to: string | null, subject: string, body: string, iec?: string) {
  await connectDB();
  if (!to && iec) {
    // the importer's alternative e-mail, when set, gets a copy of every notice
    const imp = await Importer.findOne({ iec }).select('email altEmail').lean() as any;
    to = [imp?.email, imp?.altEmail].filter(Boolean).join(', ') || null;
  }
  console.log(`[MAIL] to=${to} | ${subject} | ${body}`);
}
