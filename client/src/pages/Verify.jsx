import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Search, ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import { api } from '../lib/api.js';
import { Shell, Card, Btn, Notice, Badge, short, fmtTime } from '../components/ui.jsx';

const FIELDS = [['image', 'Modify image'], ['result', 'Modify result'], ['gps', 'Modify GPS'], ['timestamp', 'Modify timestamp'], ['delete-previous', 'Delete previous record (chain gap)']];
const ST = { valid: [<CheckCircle2 key="v" size={16} className="text-emerald-600" />, 'text-emerald-700'], invalid: [<XCircle key="i" size={16} className="text-red-600" />, 'text-red-600'], warning: [<AlertTriangle key="w" size={16} className="text-amber-500" />, 'text-amber-600'] };
export default function Verify() {
  const params = useParams(), [id, setId] = useState(params.id || ''), [file, setFile] = useState(null), [v, setV] = useState(null), [err, setErr] = useState('');
  const [demo, setDemo] = useState(false), [field, setField] = useState('image'), [busy, setBusy] = useState(false);
  useEffect(() => { api.config().then((c) => setDemo(c.tamperDemo)); if (params.id) run(params.id); }, []); // eslint-disable-line
  async function run(rid = id, f = file) { setErr(''); try { setV(await api.verify(rid.trim(), f)); } catch (e) { setV(null); setErr(e.message); } }
  const act = async (fn) => { setBusy(true); try { await fn(); await run(); } catch (e) { setErr(e.message); } setBusy(false); };
  const H = { verified: ['RECORD VERIFIED', 'Digital record integrity confirmed.', 'border-emerald-400 bg-emerald-50 text-emerald-900', ShieldCheck], failed: ['VERIFICATION FAILED', 'The current record contents no longer match the signed record.', 'border-red-300 bg-red-50 text-red-700', ShieldX], warning: ['CHAIN / KEY WARNING', 'Signature and image are intact, but the chain or key status needs review.', 'border-amber-300 bg-amber-50 text-amber-800', AlertTriangle] };
  const S = v && H[v.overall], hr = (k, a, b) => <div className="flex justify-between gap-2 py-1 text-xs"><span>{k}</span><span className="font-mono"><span className="text-emerald-700">{short(a)}</span> / <span className={a === b ? 'text-emerald-700' : 'font-bold text-red-600'}>{short(b)}</span></span></div>;
  return (<Shell title="Record Verification">
    <Card title="Record ID" icon={Search}><input className="w-full rounded border border-line px-2 py-2 text-sm" placeholder="CP-2026-000001" value={id} onChange={(e) => setId(e.target.value)} />
      <label className="mt-2 block text-xs text-slate-600">Optional: check an external copy of the image<input type="file" accept="image/*" className="mt-1 block w-full text-xs" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
      <div className="mt-2"><Btn onClick={() => run()} disabled={!id.trim()}><ShieldCheck size={16} />Verify record</Btn></div></Card>
    {err && <Notice tone="err">{err}</Notice>}
    {v && (<>
      <div className={`flex items-center gap-3 rounded-lg border-2 p-3 ${S[2]}`}>{(() => { const I = S[3]; return <I size={40} />; })()}<div><div className="text-lg font-extrabold">{S[0]}</div><div className="text-sm">{S[1]}</div></div></div>
      <Card title="Verification checks"><table className="w-full text-sm"><tbody>{v.checks.map((c) => (<tr key={c.id} className="border-t border-line"><td className="py-2">{c.label}</td>
        <td className={`py-2 text-right font-semibold ${ST[c.status][1]}`}><span className="inline-flex items-center gap-1">{ST[c.status][0]}{c.text}</span></td></tr>))}</tbody></table></Card>
      <Card title="Hash comparison"><p className="text-[11px] text-slate-500">Expected (signed) / current</p>{hr('Image SHA-256', v.hashes.imageExpected, v.hashes.imageCurrent)}{hr('Record hash', v.hashes.recordExpected, v.hashes.recordCurrent)}
        {v.usedUploadedImage && <p className="text-[11px] text-slate-500">Current image hash is from the uploaded file.</p>}</Card>
      <Card title="Record summary"><dl className="space-y-1 text-sm">{[['Record ID', v.summary.recordId], ['Result', <Badge key="b" result={v.summary.result} />], ['Operator', v.summary.operatorId], ['Timestamp', fmtTime(v.summary.timestamp)], ['Kit', v.summary.kit], ['Image Hash', short(v.summary.imageSha256)]].map(([k, x]) => <div key={k} className="flex justify-between border-t border-line pt-1"><dt className="text-slate-500">{k}</dt><dd className="font-semibold text-navy">{x}</dd></div>)}</dl></Card>
      {demo && <Card title="Security verification demonstration" icon={Wrench}><p className="mb-2 text-xs">Modify stored data to demonstrate that tampering is detected. Restore afterwards.</p>
        {FIELDS.map(([k, l]) => <label key={k} className="flex items-center gap-2 py-0.5 text-sm"><input type="radio" checked={field === k} onChange={() => setField(k)} />{l}</label>)}
        <div className="mt-2 grid grid-cols-2 gap-2"><Btn outline disabled={busy} onClick={() => act(() => api.restore(v.summary.recordId))}>Restore original</Btn><Btn disabled={busy} onClick={() => act(() => api.tamper(v.summary.recordId, field))}>Apply &amp; verify</Btn></div></Card>}
    </>)}
    <Notice title="Important information">Cryptographic verification detects modification of the digital record. It does not independently prove that the physical test occurred at the recorded location.</Notice>
    <div className="flex justify-between text-[11px] text-slate-500"><span>ChromaProof v1.0.0</span><span>Smart India Hackathon Prototype</span></div>
  </Shell>);
}
