import Link from 'next/link';
import { notFound } from 'next/navigation';
import Shell from '@/components/Shell';
import FormPanel from '@/components/FormPanel';
import LicenceEdit from '@/components/LicenceEdit';
import DataTable from '@/components/DataTable';
import ChatPanel from '@/components/ChatPanel';
import { ChatMessage } from '@/models/ChatMessage';
import { time, type SortVal } from '@/lib/sort';
import { needOfficer } from '@/lib/guard';
import { Licence } from '@/models/Licence';
import { Importer } from '@/models/Importer';
import { Submission } from '@/models/Submission';
import { fmtDate, fmtDay, fmtTs, rs, isoDate, STAGE_LABEL, SUB_STATUS } from '@/lib/format';
import { pdfInfo, readStored } from '@/lib/files';
import { bgBankContact } from '@/lib/ocr';

const GROUPS = [
  { title: 'Captured by OCR', tabs: [['details', 'Licence details'], ['bond', 'Bond'], ['bg', 'BG'], ['attachments', 'Attachments']] },
  { title: 'Submitted by party', tabs: [['ic', 'IC'], ['eodc', 'EODC'], ['dl', 'DL & misc']] },
  { title: 'Uploaded by officer', tabs: [['alerts', 'Alerts'], ['notice', 'Simple notice'], ['adjudication', 'Adjudication']] },
  { title: 'Conversation', tabs: [['chat', 'Chat with party']] },
] as const;
const file = (p?: string, dl = false) => `/api/files?p=${encodeURIComponent(p || '')}${dl ? '&dl=1' : ''}`;

// For a BG with no bank address or e-mail yet (saved before these fields existed), read them from its stored e-BG.
// The result only pre-fills the "Add bank contact" form: nothing is saved until the officer checks and saves it.
async function bgContactFromPdf(l: any) {
  const out: Record<number, ReturnType<typeof bgBankContact>> = {};
  const blank = l.bgs.map((_: any, i: number) => i).filter((i: number) => !l.bgs[i].bankAddress && !l.bgs[i].bankEmail);
  if (!blank.length) return out;
  const texts: string[] = [];
  for (const a of l.attachments.filter((x: any) => x.docType === 'e-BG' && x.path)) { try { texts.push((await pdfInfo(await readStored(a.path))).text); } catch { /* file missing: no suggestion */ } }
  for (const i of blank) {
    const c = bgBankContact(texts.find((t) => l.bgs[i].bgNo && t.includes(l.bgs[i].bgNo)) || '');
    if (c.bankAddress || c.bankEmail) out[i] = c;
  }
  return out;
}

export default async function LicencePage({ params, searchParams }: { params: { no: string }; searchParams: { tab?: string } }) {
  const s = await needOfficer();
  const l: any = await Licence.findOne({ licenceNo: params.no }).lean();
  if (!l) notFound();
  const imp: any = await Importer.findOne({ iec: l.iec }).lean();
  const subs: any[] = await Submission.find({ licenceNo: l.licenceNo }).sort({ createdAt: 1 }).lean();
  const unread = await ChatMessage.countDocuments({ licenceNo: l.licenceNo, from: 'importer', readAt: null });
  const tab = GROUPS.flatMap((g) => g.tabs.map((t) => t[0] as string)).includes(searchParams.tab || '') ? searchParams.tab! : 'details';
  const no = l.licenceNo; const adj = l.adjudication || {};
  const bgOcr = tab === 'bond' || tab === 'bg' ? await bgContactFromPdf(l) : {};
  const badge = l.status === 'closed' ? { t: `Closed · ${fmtDate(l.closedOn)}`, c: 'dark' }
    : l.stage === 'defaulter' ? { t: `Defaulter · EO ended ${fmtDate(l.eoEndsOn)}`, c: 'warn' }
    : l.stage === 'adjudication' ? { t: adj.concluded ? 'Adjudication · concluded' : adj.scn?.no ? 'Adjudication · awaiting OIO' : 'Adjudication', c: 'warn' }
    : { t: STAGE_LABEL[l.stage], c: '' };
  // Documents the party submitted, one sortable table per type. cell() returns the second column and its sort value.
  const subTable = (type: string, cols: string[], cell: (x: any) => [React.ReactNode, SortVal]) => (
    <DataTable columns={cols.map((label) => ({ label }))} empty="Nothing submitted by the party yet."
      rows={subs.filter((x) => x.type === type).map((x) => ({
        key: String(x._id),
        cells: [x.ackNo, cell(x)[0], fmtDay(x.createdAt), <>{x.status === 'action_over' ? `Action over · ${fmtDate(x.action?.on)}` : SUB_STATUS[x.status]}
          {x.status === 'received' && l.status === 'active' && <> · <Link href={`/officer/inbox/${type.toLowerCase()}/${x._id}`}>Take action</Link></>}
          {x.filePath && <> · <a href={file(x.filePath)} target="_blank">View</a></>}</>],
        sort: [x.ackNo, cell(x)[1], time(x.createdAt), SUB_STATUS[x.status]],
        cellClass: ['', '', '', x.status === 'query_raised' ? 'warn' : ''],
      }))} />
  );
  const dlCols = ['Ack no.', 'Reference', 'Submitted', 'Status'];

  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › <Link href={`/officer/${l.scheme.toLowerCase()}`}>{l.scheme}</Link> ›</div>
      <div className="hdr"><h2>{no} · {l.partyName}</h2><span className={`badge ${badge.c}`}>{badge.t}</span></div>
      <div className="row" style={{ marginBottom: 14, alignItems: 'flex-start' }}>
        {GROUPS.map((g) => <div className="group" key={g.title}><small>{g.title}</small><div className="chips">{g.tabs.map(([k, label]) => {
          const on = tab === k || (k === 'bond' && tab === 'bg') || (k === 'bg' && tab === 'bond') || (k === 'ic' && tab === 'eodc') || (k === 'eodc' && tab === 'ic') || (k === 'alerts' && tab === 'notice') || (k === 'notice' && tab === 'alerts');
          return <Link key={k} className="chip" href={`/officer/licence/${no}?tab=${k}`} aria-current={on ? 'page' : undefined}>{label}{k === 'chat' && unread > 0 && tab !== 'chat' && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}</Link>; })}</div></div>)}
      </div>

      {tab === 'details' && <div className="split" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <table className="grid"><thead><tr><th>Licence field</th><th>Value</th></tr></thead><tbody>
          <tr><td>Licence no. / date</td><td>{no} · {fmtDate(l.licenceDate)}</td></tr><tr><td>Scheme</td><td>{l.scheme}</td></tr>
          <tr><td>Issuing office</td><td>{l.issuingOffice || '–'}</td></tr><tr><td>Duty saved</td><td>{rs(l.dutySaved)}</td></tr>
          {l.eoMultiple && <tr><td>EO ({l.eoMultiple} × duty saved)</td><td>{rs(l.eoAmount)}</td></tr>}
          <tr><td>EO period ends</td><td>{fmtDate(l.eoEndsOn)}</td></tr>
          {l.icDueOn && <tr><td>IC due</td><td>{fmtDate(l.icDueOn)}</td></tr>}{l.eoBlockDueOn && <tr><td>EO block due</td><td>{fmtDate(l.eoBlockDueOn)}</td></tr>}</tbody></table>
        <div className="card"><h3 style={{ fontFamily: 'inherit', fontSize: '1.2rem' }}>Contact details</h3>
          <div><b>IEC</b> {l.iec}</div><div><b>Address</b> {imp?.address || '–'}</div><div><b>Email</b> {imp?.email}</div><div><b>Alternative email</b> {imp?.altEmail || '–'}</div><div><b>Mobile</b> {imp?.mobile}</div>
          <p className="note">Corrections are logged with user and time</p>
          <LicenceEdit licenceNo={no} init={{ licenceDate: isoDate(l.licenceDate), eoEndsOn: isoDate(l.eoEndsOn), issuingOffice: l.issuingOffice || '', partyName: l.partyName, dutySaved: String(l.dutySaved || ''), address: imp?.address || '', email: imp?.email || '', altEmail: imp?.altEmail || '', mobile: imp?.mobile || '' }} />
          {l.corrections?.length > 0 && <details style={{ marginTop: 12 }}><summary>Correction log ({l.corrections.length})</summary>
            {l.corrections.map((c: any, i: number) => <div className="note" key={i}>{c.field}: {c.from || '–'} → {c.to} · {c.by} · {fmtTs(c.at)}</div>)}</details>}</div></div>}

      {(tab === 'bond' || tab === 'bg') && <>
        <div className="grid2">
          <div className="card"><h3 style={{ fontFamily: 'inherit' }}>Bond</h3>{l.bonds.map((b: any, i: number) => <div key={i} style={{ marginBottom: 12 }}>
            <div><b>Bond no.</b> {b.bondNo}</div><div><b>Bond date</b> {fmtDate(b.bondDate)}</div><div><b>Bond amount</b> {rs(b.amount)}</div><div><b>Executed at</b> {b.executedAt || '–'}</div><div><b>Status</b> {b.status}</div></div>)}</div>
          <div className="card"><h3 style={{ fontFamily: 'inherit' }}>Bank guarantee</h3>{l.bgs.length ? l.bgs.map((g: any, i: number) => <div key={i} style={{ marginBottom: 12 }}>
            <div><b>BG no.</b> {g.bgNo}</div><div><b>Bank</b> {g.bank}{g.branch ? `, ${g.branch} branch` : ''}</div><div><b>BG amount</b> {rs(g.amount)}</div><div><b>Valid till</b> {fmtDate(g.validTill)}</div><div><b>Linked e-Bond</b> {g.linkedBond}</div>
            <div><b>Bank address</b> {g.bankAddress || '–'}</div><div><b>Bank email</b> {g.bankEmail ? <a href={`mailto:${g.bankEmail}`}>{g.bankEmail}</a> : '–'}</div>
            {bgOcr[i] && <p className="note" style={{ margin: '6px 0 0' }}>Bank contact was read from the e-BG by OCR: open the form, check it and save.</p>}
            <FormPanel url={`/api/officer/licences/${no}/bonds`} label={g.bankAddress || g.bankEmail ? 'Edit bank contact' : '+ Add bank contact'} hidden={{ kind: 'bgContact', index: String(i), bgNo: g.bgNo }}
              fields={[{ name: 'bankAddress', label: 'Bank address', type: 'textarea', defaultValue: g.bankAddress || bgOcr[i]?.bankAddress || '' }, { name: 'bankEmail', label: 'Bank email', type: 'email', defaultValue: g.bankEmail || bgOcr[i]?.bankEmail || '' }]} /></div>) : <p className="note">No BG on this licence.</p>}</div>
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <FormPanel url={`/api/officer/licences/${no}/bonds`} label="+ Add bond" hidden={{ kind: 'bond' }} file="e-Bond" fileRequired={false} fields={[{ name: 'bondNo', label: 'Bond no.', required: true }, { name: 'bondDate', label: 'Bond date', type: 'date', required: true }, { name: 'amount', label: 'Bond amount (₹)', type: 'number', required: true }, { name: 'executedAt', label: 'Executed at' }]} />
          <FormPanel url={`/api/officer/licences/${no}/bonds`} label="+ Add BG" hidden={{ kind: 'bg' }} file="e-BG" fileRequired={false} fields={[{ name: 'bgNo', label: 'BG no.', required: true }, { name: 'bank', label: 'Bank', required: true }, { name: 'branch', label: 'Branch' }, { name: 'amount', label: 'BG amount (₹)', type: 'number', required: true }, { name: 'validTill', label: 'Valid till', type: 'date', required: true }, { name: 'linkedBond', label: 'Linked e-Bond', type: 'select', options: l.bonds.map((b: any) => b.bondNo) }, { name: 'bankAddress', label: 'Bank address (read from the e-BG if left blank)', type: 'textarea' }, { name: 'bankEmail', label: 'Bank email (read from the e-BG if left blank)', type: 'email' }]} />
        </div></>}

      {tab === 'attachments' && <>
        <DataTable columns={[{ label: 'File' }, { label: 'Document' }, { label: 'Pages', align: 'r' }, { label: 'Uploaded by' }, { label: 'Date' }, { label: 'Open', sortable: false }]} empty="No attachments."
          rows={l.attachments.map((a: any, i: number) => ({
            key: String(i),
            cells: [a.fileName, a.docType, a.pages, a.uploadedBy, fmtDay(a.uploadedAt), a.path ? <><a href={file(a.path)} target="_blank">View</a> · <a href={file(a.path, true)}>Save</a></> : '–'],
            sort: [a.fileName, a.docType, a.pages, a.uploadedBy, time(a.uploadedAt), null],
          }))} />
        <p className="note">Attachments are read-only. If a document is replaced, for example by a new BG, the new file is added here and the old one stays.</p></>}

      {(tab === 'ic' || tab === 'eodc') && <>
        <h3 style={{ fontFamily: 'inherit', fontSize: '1.1rem' }}>Installation certificate</h3>
        {subTable('IC', ['Ack no.', 'Certificate', 'Submitted', 'Status'], (x) => [`${x.details?.certifiedBy || ''} · ${fmtDate(x.details?.certDate)}`, time(x.details?.certDate)])}
        <h3 style={{ fontFamily: 'inherit', fontSize: '1.1rem', marginTop: 18 }}>Export obligation discharge certificate (EODC)</h3>
        {subTable('EODC', ['Ack no.', 'EODC no. / date (DGFT)', 'Submitted', 'Status'], (x) => [`${x.details?.eodcNo || ''} · ${fmtDate(x.details?.eodcDate)}`, x.details?.eodcNo])}
        {l.status === 'closed' && <p className="attn" style={{ background: 'var(--okbg)', borderColor: '#c8dccd', color: 'var(--ok)' }}>Action over on this EODC by {l.closedBy}, on {fmtDate(l.closedOn)}. The licence was <b>closed automatically</b> and moved from {l.scheme} Active to {l.scheme} Closed.</p>}</>}

      {tab === 'dl' && <>
        <h3 style={{ fontFamily: 'inherit', fontSize: '1.1rem' }}>Replies to deficiency letters</h3>
        {subTable('DL', dlCols, (x) => [`${x.details?.dlRef || ''} ${x.details?.dlDate ? `· ${fmtDate(x.details.dlDate)}` : ''}`, x.details?.dlRef])}
        <h3 style={{ fontFamily: 'inherit', fontSize: '1.1rem', marginTop: 18 }}>Other documents</h3>
        {subTable('MS', ['Ack no.', 'Subject', 'Submitted', 'Status'], (x) => [x.details?.subject, x.details?.subject])}</>}

      {(tab === 'alerts' || tab === 'notice') && <>
        <div className="grid2">
          {(['alert', 'notice'] as const).map((kind) => (
            <div className="card" key={kind}>
              <div className="row end" style={{ marginTop: 0 }}><h3 style={{ fontFamily: 'inherit' }}>{kind === 'alert' ? 'Alerts' : 'Simple notices'}</h3>
                <FormPanel url={`/api/officer/licences/${no}/letters`} label="+ Upload" hidden={{ kind }} file="Letter" fields={[{ name: 'title', label: 'Title', required: true }, { name: 'letterNo', label: 'Letter no.', required: kind === 'notice' }, { name: 'date', label: 'Date', type: 'date', required: true }]} /></div>
              {l.letters.filter((x: any) => x.kind === kind).map((x: any, i: number) => <div key={i} style={{ borderTop: '1px solid #e1dccd', padding: '10px 0' }}><b>{x.title}</b>
                <div className="note">{kind === 'notice' && <>No. {x.letterNo || '[__]'} · </>}{fmtDate(x.date)} · {x.uploadedBy} · {x.path ? <a href={file(x.path)} target="_blank">{kind === 'alert' ? 'Alert' : 'Notice'}.pdf</a> : 'system-generated'}</div></div>)}
              {!l.letters.some((x: any) => x.kind === kind) && <p className="note">None yet.</p>}
            </div>))}
        </div>
        <p className="note">Upload asks for: title, letter no., date and PDF.</p></>}

      {tab === 'chat' && <ChatPanel licenceNo={no} role="officer" title={`Chat with ${l.partyName}`} />}

      {tab === 'adjudication' && <div className="grid3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <div className={`stage ${adj.scn?.no ? '' : 'pending'}`}><small className="k">Stage 1 · {adj.scn?.no ? 'Done' : 'Pending'}</small><h3 style={{ fontFamily: 'inherit' }}>Show cause notice</h3>
          {adj.scn?.no ? <><div>SCN No. {adj.scn.no}</div><div>Dated {fmtDate(adj.scn.date)}</div><div>Duty {rs(adj.scn.dutyAmount)}{adj.scn.interest ? ' + interest' : ''}</div><div><a href={file(adj.scn.path)} target="_blank">SCN.pdf</a> · {adj.scn.by}</div></>
            : <FormPanel url={`/api/officer/licences/${no}/adjudication`} label="+ Upload SCN" small={false} hidden={{ step: 'scn' }} file="SCN" fields={[{ name: 'no', label: 'SCN no.', required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'dutyAmount', label: 'Duty demanded (₹)', type: 'number', required: true }, { name: 'interest', label: 'Interest demanded?', type: 'select', options: ['', 'yes'] }]} />}</div>
        <div className={`stage ${adj.scn?.no && !adj.ph?.length ? 'pending' : ''}`}><small className="k">Stage 2 · {adj.ph?.length ? 'Done' : 'Pending'}</small><h3 style={{ fontFamily: 'inherit' }}>PH notices ({adj.ph?.length || 0})</h3>
          {(adj.ph || []).map((p: any, i: number) => <div key={i} style={{ marginBottom: 8 }}>PH-{i + 1} · {fmtDate(p.phDate)}<div className="note">Hearing {fmtDate(p.hearingDate)} · {p.outcome}{p.path && <> · <a href={file(p.path)} target="_blank">PH.pdf</a></>}</div></div>)}
          <FormPanel url={`/api/officer/licences/${no}/adjudication`} label="+ Add PH notice" disabled={!adj.scn?.no || adj.concluded} hint="Record the show cause notice first" hidden={{ step: 'ph' }} file="PH notice" fileRequired={false}
            fields={[{ name: 'phDate', label: 'PH notice date', type: 'date', required: true }, { name: 'hearingDate', label: 'Hearing date', type: 'date', required: true }, { name: 'outcome', label: 'Hearing outcome', type: 'select', options: ['scheduled', 'attended', 'adjourned', 'not attended'] }]} /></div>
        <div className={`stage ${adj.concluded ? '' : 'pending'}`}><small className="k">Stage 3 · {adj.concluded ? 'Done' : 'Pending'}</small><h3 style={{ fontFamily: 'inherit' }}>Order-in-Original</h3>
          {adj.oio?.no ? <><div>OIO No. {adj.oio.no}</div><div>Dated {fmtDate(adj.oio.date)}</div><div>Outcome: {adj.oio.outcome}</div><div><a href={file(adj.oio.path)} target="_blank">OIO.pdf</a> · {adj.oio.by}</div><p className="okmsg">Adjudication concluded</p></>
            : <><p className="note">Upload OIO no., date, outcome and PDF</p><FormPanel url={`/api/officer/licences/${no}/adjudication`} label="+ Upload OIO" small={false} disabled={!adj.ph?.length} hint="Add a PH notice first" hidden={{ step: 'oio' }} file="OIO"
              fields={[{ name: 'no', label: 'OIO no.', required: true }, { name: 'date', label: 'Date', type: 'date', required: true }, { name: 'outcome', label: 'Outcome', type: 'select', options: ['duty confirmed', 'partly confirmed', 'dropped'] }]} /><p className="note">Uploading the OIO marks adjudication concluded</p></>}</div>
      </div>}
    </Shell>
  );
}
