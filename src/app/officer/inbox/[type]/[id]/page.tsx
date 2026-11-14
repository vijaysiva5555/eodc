import Link from 'next/link';
import { notFound } from 'next/navigation';
import mongoose from 'mongoose';
import Shell from '@/components/Shell';
import ActionForm from '@/components/ActionForm';
import { needOfficer } from '@/lib/guard';
import { Submission } from '@/models/Submission';
import { fmtDay, fmtDate, INBOX_SLUG, SUB_TYPE, SUB_STATUS } from '@/lib/format';

const DETAIL: Record<string, [string, string][]> = {
  IC: [['certifiedBy', 'Certified by'], ['certDate', 'Certificate date']], EODC: [['eodcNo', 'EODC no.'], ['eodcDate', 'EODC date']],
  DL: [['dlRef', 'DL no.'], ['dlDate', 'DL date'], ['remarks', 'Remarks']], MS: [['subject', 'Subject'], ['remarks', 'Remarks']],
};
const isDate = (k: string) => /Date$/.test(k);

export default async function TakeAction({ params }: { params: { type: string; id: string } }) {
  const type = INBOX_SLUG[params.type]; if (!type || !mongoose.isValidObjectId(params.id)) notFound();
  const s = await needOfficer();
  const x: any = await Submission.findById(params.id).lean(); if (!x || x.type !== type) notFound();
  const { Licence } = await import('@/models/Licence');
  const lic: any = await Licence.findOne({ licenceNo: x.licenceNo }).select('scheme status').lean();
  const back = `/officer/inbox/${params.type}`;
  const pdf = x.reply?.filePath || x.filePath;
  return (
    <Shell s={s}>
      <div className="crumb"><Link href="/officer">Home</Link> › <Link href={back}>Inbox</Link> › {x.ackNo}</div>
      <div className="split" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="pdfbox"><div className="row end" style={{ margin: '0 0 8px' }}><b>{x.fileName}</b><span>{x.reply?.filePath && <a href={`/api/files?p=${encodeURIComponent(x.filePath)}`} target="_blank">Original</a>}</span></div>
          <iframe title="Submitted document" src={`/api/files?p=${encodeURIComponent(pdf)}`} /></div>
        <div>
          <div className="hdr" style={{ marginBottom: 4 }}><h2>{x.ackNo} · {lic?.scheme} <Link href={`/officer/licence/${x.licenceNo}`}>{x.licenceNo}</Link></h2></div>
          <p className="note">{x.partyName} · received {fmtDay(x.createdAt)}{x.reply?.repliedOn ? ` · query replied ${fmtDay(x.reply.repliedOn)}` : ''}</p>
          <table className="grid" style={{ marginBottom: 14 }}><tbody>{(DETAIL[type] || []).filter(([k]) => x.details?.[k]).map(([k, l]) => <tr key={k}><td>{l}</td><td>{isDate(k) ? fmtDate(x.details[k]) : x.details[k]}</td></tr>)}</tbody></table>
          {x.query?.text && <div className="attn" style={{ marginBottom: 14 }}><b>Query raised {fmtDate(x.query.raisedOn)} by {x.query.raisedBy}</b><div>{x.query.text}</div>{x.reply?.text && <div><b>Reply:</b> {x.reply.text}</div>}</div>}
          {x.status === 'received' && lic?.status === 'active' ? <ActionForm id={String(x._id)} type={type} licenceNo={x.licenceNo} scheme={lic.scheme} backHref={back} />
            : <div className="card"><b>{SUB_STATUS[x.status]}</b>{x.action && <div>By {x.action.by} on {fmtDate(x.action.on)}<br />{x.action.remarks} · {x.action.eOfficeRef}</div>}{x.status === 'query_raised' && <p className="note">Waiting for the importer’s reply.</p>}</div>}
        </div>
      </div>
    </Shell>
  );
}
