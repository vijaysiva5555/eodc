import Link from 'next/link';
import Shell from '@/components/Shell';
import LicenceWizard from '@/components/LicenceWizard';
import { needOfficer } from '@/lib/guard';

export default async function NewLicence() {
  const s = await needOfficer();
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › Add new licence</div>
      <h2>Add new licence</h2>
      <p className="note">Upload the three PDFs after e-Bond generation, then run OCR.</p>
      <LicenceWizard />
    </Shell>
  );
}
