'use client';
import { useState } from 'react';
import Link from 'next/link';
import { send } from './api';

type Field = { key: string; label: string; value: string; status: 'OK' | 'Check'; source: 'licence' | 'ebond' | 'ebg'; note?: string };
type Ocr = { token: string; paths: Record<string, string | null>; fields: Field[]; pages: Record<string, number>; warning?: string; duplicate: { licenceNo: string; scheme: string; status: string; partyName: string } | null };

const DOCS = [
  { key: 'licence', title: 'Licence (DGFT)', required: true }, { key: 'ebond', title: 'e-Bond (ICEGATE)', required: true }, { key: 'ebg', title: 'e-BG (if any)', required: false },
] as const;
const DATE_KEYS = ['licenceDate', 'bondDate', 'bgValidTill', 'eoEndsOn'];

export default function LicenceWizard() {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [ocr, setOcr] = useState<Ocr | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [viewer, setViewer] = useState<'licence' | 'ebond' | 'ebg'>('ebond');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [saved, setSaved] = useState<{ licenceNo: string; scheme: string } | null>(null);
  const step = saved ? 4 : ocr ? 3 : 1;

  async function run() {
    setErr('');
    if (!files.licence || !files.ebond) return setErr('Upload the licence and the e-Bond PDFs');
    setBusy(true);
    try {
      const fd = new FormData(); DOCS.forEach((d) => files[d.key] && fd.set(d.key, files[d.key]!));
      const r: Ocr = await send('/api/officer/licences/ocr', fd);
      setOcr(r); setFields(r.fields);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const edit = (key: string, value: string) => setFields(fields.map((f) => (f.key === key ? { ...f, value, status: 'Check' } : f)));
  const confirm = (key: string) => setFields(fields.map((f) => (f.key === key ? { ...f, status: 'OK', note: undefined } : f)));
  const checks = fields.filter((f) => f.status === 'Check').length;

  async function save() {
    setErr(''); setBusy(true);
    try {
      const values = Object.fromEntries(fields.map((f) => [f.key, f.value]));
      setSaved(await send('/api/officer/licences', JSON.stringify({ token: ocr!.token, paths: ocr!.paths, values })));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <div className="steps" aria-label="Progress">
        {['1 Upload', '2 Run OCR', '3 Check fields', '4 Save'].map((t, i) => <span key={t} className={step === i + 1 || (step === 3 && i === 1) || (step === 4 && i < 4) ? 'on' : ''}>{t}</span>)}
      </div>

      {!ocr && <>
        <div className="grid3" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
          {DOCS.map((d) => (
            <div className="dash" key={d.key}>
              <h3 style={{ fontFamily: 'inherit', fontSize: '1.2rem' }}>{d.title}</h3>
              <input type="file" accept="application/pdf" aria-label={d.title} onChange={(e) => setFiles({ ...files, [d.key]: e.target.files?.[0] || null })} />
              <p className="note" style={{ margin: '8px 0 0' }}>{files[d.key] ? `${files[d.key]!.name} · ${(files[d.key]!.size / 1048576).toFixed(1)} MB` : d.required ? 'Required' : 'Optional'}</p>
            </div>))}
        </div>
        <div className="row"><button className="clay" onClick={run} disabled={busy}>{busy ? 'Reading PDFs…' : 'Run OCR'}</button><span className="note">Nothing is saved until the fields are checked on the next screen.</span></div>
      </>}

      {ocr && !saved && <div className="split" style={{ gridTemplateColumns: '1fr 1.3fr' }}>
        <div className="pdfbox">
          <div className="chips" style={{ marginBottom: 8 }}>{DOCS.filter((d) => ocr.paths[d.key]).map((d) => <button key={d.key} className={viewer === d.key ? '' : 'ghost'} onClick={() => setViewer(d.key)}>{d.title.split(' ')[0]} · {ocr.pages[d.key]} p</button>)}</div>
          <iframe title="Source PDF" src={`/api/files?p=${encodeURIComponent(ocr.paths[viewer] || ocr.paths.licence!)}`} />
        </div>
        <div>
          {ocr.warning && <p className="attn">{ocr.warning}</p>}
          <table className="grid"><thead><tr><th>Field</th><th>Extracted value</th><th>OCR</th></tr></thead>
            <tbody>{fields.map((f) => (
              <tr key={f.key}><td>{f.label}</td>
                <td><input aria-label={f.label} type={DATE_KEYS.includes(f.key) ? 'date' : 'text'} value={f.value} onChange={(e) => edit(f.key, e.target.value)} style={{ padding: '4px 8px' }} />{f.note && <div className="note warn">{f.note}</div>}</td>
                <td>{f.status === 'OK' ? 'OK' : <button className="ghost small" onClick={() => confirm(f.key)} disabled={!f.value}>Check ✓</button>}</td></tr>))}</tbody></table>
          <div className="row">
            <button onClick={save} disabled={busy || checks > 0 || !!ocr.duplicate}>{busy ? 'Saving…' : 'Save licence'}</button>
            {ocr.duplicate ? <span className="err">Duplicate: licence {ocr.duplicate.licenceNo} already exists ({ocr.duplicate.partyName}, {ocr.duplicate.status}).</span>
              : checks > 0 ? <span className="warn">{checks} field{checks > 1 ? 's' : ''} flagged. Correct the value, then press Check ✓.</span>
              : <span className="okmsg">No duplicate · will go to {fields.find((f) => f.key === 'scheme')?.value} › Active licences</span>}
            <button className="ghost" onClick={() => { setOcr(null); setFields([]); }}>Start over</button>
          </div>
        </div>
      </div>}

      {saved && <div className="success" role="status"><h3>Licence {saved.licenceNo} saved</h3>
        <p>It now appears under {saved.scheme} › Active licences, and the importer will see it after registering with the e-Bond contact details.</p>
        <div className="row"><Link className="btn" href={`/officer/licence/${saved.licenceNo}`}>Open licence page</Link><Link className="btn ghost" href="/officer/licence/new" onClick={() => location.assign('/officer/licence/new')}>Add another</Link></div></div>}
      {err && <p className="err" role="alert">{err}</p>}
    </div>
  );
}
