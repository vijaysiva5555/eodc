import { Importer } from '@/models/Importer';
import { connectDB } from './db';

// TODO: connect an SMTP / e-mail service. For now messages are logged on the server.
export async function sendMail(to: string | null, subject: string, body: string, iec?: string) {
  await connectDB();
  if (!to && iec) to = (await Importer.findOne({ iec }).select('email').lean() as any)?.email ?? null;
  console.log(`[MAIL] to=${to} | ${subject} | ${body}`);
}
