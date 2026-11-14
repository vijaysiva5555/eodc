import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import ChatPanel from '@/components/ChatPanel';
import { needImporter } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { fmtDate, rs } from '@/lib/format';
import { importerStatus, importerStatusWarn } from '@/lib/rules';

export default async function ImporterLicence({ params }: { params: { no: string } }) {
  const s = await needImporter();
  const l: any = await Licence.findOne({ licenceNo: params.no, iec: s.iec }).lean();
  if (!l) notFound();
  const slug = l.scheme.toLowerCase();
  const closed = l.status === 'closed';
  const base = `/importer/licence/${l.licenceNo}/submit`;
  const rows: [string, React.ReactNode][] = [
    ['Licence date', fmtDate(l.licenceDate)], ['Party', `${l.partyName}`],
    ...l.bonds.map((b: any, i: number): [string, string] => [l.bonds.length > 1 ? `Bond ${i + 1} no. / date` : 'Bond no. / date', `${b.bondNo} · ${fmtDate(b.bondDate)}`]),
    ['Bond amount', l.bonds.map((b: any) => rs(b.amount)).join(' + ')],
    ...l.bgs.map((g: any): [string, string] => ['e-BG', `${g.bgNo} · ${rs(g.amount)} · till ${fmtDate(g.validTill)}`]),
    ['Duty saved', rs(l.dutySaved)],
    ...(l.eoMultiple ? [[`EO (${l.eoMultiple} × duty saved)`, rs(l.eoAmount)] as [string, string]] : []),
    ['EO period ends', fmtDate(l.eoEndsOn)],
  ];
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/importer">Home</Link> › <Link href={`/importer/${slug}`}>{l.scheme}</Link> › {l.licenceNo}</div>
      <div className="hdr"><h2>{l.scheme} licence {l.licenceNo}</h2><span className={`badge ${importerStatusWarn(l) ? 'warn' : closed ? 'dark' : ''}`}>{l.stage === 'ic_pending' && l.icDueOn ? `IC pending · due ${fmtDate(l.icDueOn)}` : closed && l.closedOn ? `Closed · ${fmtDate(l.closedOn)}` : importerStatus(l)}</span></div>
      <div className="split">
        <table className="grid"><thead><tr><th>Field</th><th>Value</th></tr></thead>
          <tbody>{rows.map(([k, v], i) => <tr key={i}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
        <div>
          {closed ? <p className="note">This licence is closed. No further documents can be submitted.</p> : <>
            <div className="note">Submit against this licence</div>
            <div className="actions" style={{ marginTop: 8 }}>
              {l.scheme === 'EPCG' && <Link className="btn" href={`${base}/ic`}>Installation certificate</Link>}
              <Link className="btn" href={`${base}/eodc`}>EODC</Link>
              <Link className="btn" href={`${base}/dl`}>Reply to deficiency letter</Link>
              <Link className="btn ghost" href={`${base}/ms`}>Other document</Link>
            </div></>}
          <p className="note">Files: {l.attachments.map((a: any, i: number) => <span key={i}>{i > 0 && ' · '}<a href={`/api/files?p=${encodeURIComponent(a.path)}`} target="_blank">{a.docType === 'DGFT licence' ? 'Licence' : a.docType}.pdf</a></span>)}</p>
          <p className="note">Fields are read from your documents by OCR and cannot be edited here. Use the messages below to ask the EODC cell to correct an entry.</p>
        </div>
      </div>
      <div id="chat" style={{ marginTop: 22, scrollMarginTop: 20 }}><ChatPanel licenceNo={l.licenceNo} role="importer" title="Messages with the EODC cell" /></div>
    </Shell>
  );
}
