import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Shell from '@/components/Shell';
import SubmitForm from '@/components/SubmitForm';
import { needImporter } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { Importer } from '@/models/Importer';
import { mask } from '@/lib/otp';

export default async function SubmitPage({ params }: { params: { no: string; type: string } }) {
  if (!['ic', 'eodc', 'dl', 'ms'].includes(params.type)) notFound();
  const s = await needImporter();
  const l: any = await Licence.findOne({ licenceNo: params.no, iec: s.iec }).lean();
  if (!l) notFound();
  if (l.status === 'closed' || (params.type === 'ic' && l.scheme !== 'EPCG')) redirect(`/importer/licence/${l.licenceNo}`);
  const imp: any = await Importer.findOne({ iec: s.iec }).lean();
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/importer">Home</Link> › <Link href={`/importer/${l.scheme.toLowerCase()}`}>{l.scheme}</Link> › <Link href={`/importer/licence/${l.licenceNo}`}>{l.licenceNo}</Link></div>
      <SubmitForm licenceNo={l.licenceNo} scheme={l.scheme} type={params.type as any} email={mask.email(imp?.email || '')} />
    </Shell>
  );
}
