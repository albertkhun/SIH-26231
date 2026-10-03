import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ShieldCheck, Search } from 'lucide-react';
import { api, getDevice, clearDevice } from '../lib/api.js';
import { Shell, Card, Btn, Badge, DemoTag, Notice, ConfigMissing, fmtTime } from '../components/ui.jsx';

export default function Home() {
  const [cfg, setCfg] = useState(null), [rows, setRows] = useState([]), [f, setF] = useState({ q: '', kit: '', result: '', operator: '', from: '', to: '' });
  const [dev, setDev] = useState(getDevice()), [op, setOp] = useState(''), [code, setCode] = useState(''), [err, setErr] = useState('');
  useEffect(() => { if (getDevice()) api.me().catch(() => { clearDevice(); setDev(null); setErr('Previous device registration was not found on this server. Please enrol again.'); }); }, []);
  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { const t = setTimeout(() => api.list(f).then(setRows).catch((e) => setErr(e.message)), 250); return () => clearTimeout(t); }, [f]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value }), inp = 'w-full rounded border border-line bg-white px-2 py-2 text-sm';
  const enrol = async () => { try { setDev(await api.enrol(op.trim(), code)); setErr(''); } catch (e) { setErr(e.message); } };
  return (<Shell title="Test Log" back={false}>
    {err && <Notice tone="err">{err}</Notice>}
    {cfg && !cfg.status.ready && <ConfigMissing missing={cfg.status.missing} />}
    {dev ? <Card><div className="flex items-center justify-between text-sm"><span>Operator <b>{dev.operatorId}</b> · Device <b>{dev.deviceId}</b></span><button className="text-xs font-semibold text-brand underline" onClick={() => { clearDevice(); setDev(null); }}>Re-enrol</button></div></Card>
      : <Card title="Enrol this device"><div className="space-y-2"><input className={inp} placeholder="Operator ID" value={op} onChange={(e) => setOp(e.target.value)} />
        <input className={inp} placeholder="Enrolment code (if required)" value={code} onChange={(e) => setCode(e.target.value)} /><Btn onClick={enrol} disabled={!op.trim()}>Enrol device</Btn></div></Card>}
    <div className="grid grid-cols-2 gap-2"><Link to="/new"><Btn><Camera size={18} />New Field Test</Btn></Link><Link to="/verify"><Btn outline><ShieldCheck size={18} />Verify</Btn></Link></div>
    <div className="flex justify-between text-xs font-semibold text-brand"><Link to="/calibrate" className="underline">Calibration mode</Link><Link to="/card" className="underline">Reference card</Link></div>
    <Card title="Search log" icon={Search}><div className="space-y-2">
      <input className={inp} placeholder="Record ID or Sample ID" value={f.q} onChange={set('q')} />
      <div className="grid grid-cols-2 gap-2"><select className={inp} value={f.kit} onChange={set('kit')}><option value="">All kits</option>{cfg && Object.entries(cfg.kits).filter(([k]) => !k.startsWith('_')).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select>
        <select className={inp} value={f.result} onChange={set('result')}><option value="">All results</option>{['positive', 'negative', 'inconclusive', 'invalid'].map((r) => <option key={r}>{r}</option>)}</select></div>
      <input className={inp} placeholder="Operator ID" value={f.operator} onChange={set('operator')} />
      <div className="grid grid-cols-2 gap-2"><input type="date" className={inp} value={f.from} onChange={set('from')} /><input type="date" className={inp} value={f.to} onChange={set('to')} /></div></div></Card>
    <div className="space-y-2">{rows.length === 0 && <p className="text-center text-sm text-slate-500">No records found.</p>}
      {rows.map((r) => (<Link key={r.recordId} to={`/record/${r.recordId}`} className="block rounded-lg border border-line p-3">
        <div className="flex items-center justify-between"><b className="text-navy">{r.recordId}{r.demoConfig && <DemoTag />}</b><Badge result={r.result} /></div>
        <div className="mt-1 text-xs text-slate-600">{cfg?.kits[r.kit]?.name || r.kit} · {r.sampleId} · {r.operatorId}</div><div className="text-xs text-slate-500">{fmtTime(r.timestamp)}</div>
        {r.result === 'invalid' && <div className="mt-1 text-xs text-red-700">{r.invalidReasons?.join('; ')}</div>}</Link>))}</div>
  </Shell>);
}