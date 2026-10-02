import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileText, MapPin, Smartphone, Image, KeyRound, Link2, Info, Download, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api, imageUrl } from '../lib/api.js';
import { Shell, Card, Grid, Btn, Notice, Badge, DemoTag, short, fmtTime } from '../components/ui.jsx';

export default function RecordPage() {
  const { id } = useParams(), [r, setR] = useState(null), [kits, setKits] = useState({}), [err, setErr] = useState('');
  useEffect(() => { api.record(id).then(setR).catch((e) => setErr(e.message)); api.config().then((c) => setKits(c.kits)); }, [id]);
  if (err) return <Shell title="Digital Test Record"><Notice tone="err">{err}</Notice></Shell>;
  if (!r) return <Shell title="Digital Test Record" />;
  const p = r.payload, g = p.gps || {}, saveOffline = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ payload: p, signature: r.signature, recordHash: r.recordHash }, null, 2)], { type: 'application/json' }));
    a.download = `${p.recordId}.json`; a.click();
  };
  return (<Shell title="Digital Test Record">
    <div className="flex items-center gap-3 rounded-lg border-2 border-emerald-400 bg-emerald-50 p-3"><CheckCircle2 className="text-emerald-700" size={36} />
      <div className="flex-1"><div className="font-extrabold text-emerald-900">RECORD SIGNED</div><div className="text-xs">Digital record created and signed.</div></div>
      <div className="text-right text-xs">Record ID<div className="text-sm font-extrabold text-navy">{p.recordId}{p.demoConfig && <DemoTag />}</div></div></div>
    <Card title="Test Information" icon={FileText}><Grid cols={2} items={[['Kit Type', kits[p.kit]?.name || p.kit], ['Sample ID', p.sampleId], ['Result', <Badge key="r" result={p.result} />], ['Operator ID', p.operatorId]]} />
      {p.invalidReasons?.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-red-700">{p.invalidReasons.map((x) => <li key={x}>{x}</li>)}</ul>}</Card>
    <Card title="Time & Location" icon={MapPin}><Grid cols={1} items={[['Device Timestamp', fmtTime(p.timestamp)], ['GPS Location', g.status === 'recorded' ? `${g.lat.toFixed(5)}, ${g.lon.toFixed(5)}` : 'Not available'], ['GPS Accuracy', g.accuracyM != null ? `${g.accuracyM} m` : '–']]} /></Card>
    <Card title="Device Information" icon={Smartphone}><Grid items={[['Device ID', p.deviceId], ['Application Version', p.appVersion]]} /></Card>
    <Card title="Image Integrity" icon={Image}><Grid items={[['SHA-256', <span key="h" className="font-mono">{short(p.imageSha256)}</span>]]} /><img src={imageUrl(p.recordId)} alt="" className="mt-2 w-full rounded" /></Card>
    <Card title="Digital Signature" icon={KeyRound}><Grid cols={1} items={[['Algorithm', p.signing.algorithm], ['Key ID', p.signing.keyId], ['Key Protection', p.signing.keyProtection]]} /></Card>
    <Card title="Chain Information" icon={Link2}><Grid items={[['Previous Record Hash', <span key="a" className="font-mono">{short(p.prevHash)}</span>], ['Current Record Hash', <span key="b" className="font-mono">{short(r.recordHash)}</span>]]} /></Card>
    <Notice title="Record integrity">The digital signature verifies that the signed record has not been altered after signing. It does not independently prove that the physical test occurred at the recorded location.</Notice>
    <div className="grid grid-cols-2 gap-2"><Link to={`/verify/${p.recordId}`}><Btn><ShieldCheck size={16} />Verify record</Btn></Link><Btn outline onClick={saveOffline}><Download size={16} />Save offline</Btn></div>
  </Shell>);
}
