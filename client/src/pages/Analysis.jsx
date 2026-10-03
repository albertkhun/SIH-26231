import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Image, Crosshair, Droplet, Scale, PenLine, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api, store } from '../lib/api.js';
import { classify } from '../../../shared/classify.js';
import { Shell, Card, Grid, Btn, Notice, RESULT } from '../components/ui.jsx';

const EXPLAIN = { positive: 'Measured colour is sufficiently close to the selected positive reference and clearly separated from the alternative.', negative: 'Measured colour is sufficiently close to the negative reference and clearly separated from the alternative.', inconclusive: 'The image is valid, but the measured colour does not provide sufficient separation between outcome classes.' };
export default function Analysis() {
  const nav = useNavigate(), p = store.pending, [cfg, setCfg] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (!p) nav('/', { replace: true }); else api.config().then(setCfg); }, []); // eslint-disable-line
  if (!p || !cfg) return <Shell title="Test Analysis" />;
  const { meta } = p, kit = cfg.kits[meta.kit], c = meta.calibration, lab = meta.measurement.lab, cmp = classify(lab, kit), R = RESULT[cmp.result];
  const f = (v) => (v == null ? '–' : v.toFixed(1)), ref = (o) => cmp.refs.find((r) => r.outcome === o);
  const save = async () => { setBusy(true); try { const out = await api.save(p.blob, meta); store.pending = null; store.shot = null; nav(`/record/${out.recordId}`); } catch (e) { setErr(e.message); setBusy(false); } };
  return (<Shell title="Test Analysis">
    <Card title="Test Information" icon={FileText}><Grid items={[['Kit', kit.name], ['Sample ID', meta.sampleId], ['Captured', new Date(meta.timestamp).toLocaleTimeString('en-GB')]]} /></Card>
    <Card title="Captured Test Image" icon={Image}><img src={p.url} alt="Captured test" className="w-full rounded" /></Card>
    <Card title="1. Colour calibration" icon={Crosshair}>
      {c.mode === 'ccm-3x4' ? <><Grid items={[['ΔE00 before calibration', f(c.deltaEBefore)], ['ΔE00 after calibration', f(c.deltaEAfter)]]} />
        <p className="mt-1 text-[11px] text-slate-500">Mean over {c.patchesUsed} card patches (fit residual, same patches used for fitting).</p></>
        : <Notice tone="warn" title="White-balance only">No measured card values available. Absolute colour accuracy is not claimed.</Notice>}</Card>
    <Card title="2. Colour measurement" icon={Droplet}><Grid items={[['L*', f(lab[0])], ['a*', f(lab[1])], ['b*', f(lab[2])]]} /></Card>
    <Card title="3. Reference comparison" icon={Scale}>
      <Grid items={[...['positive', 'negative'].map((o) => [`${ref(o)?.label || o} ΔE00`, f(ref(o)?.deltaE)]), ['Runner-up separation', f(cmp.separation)]]} />
      <p className="mt-1 text-[11px] text-slate-500">Rule: nearest ΔE00 ≤ {kit.thresholds.tClose} and separation ≥ {kit.thresholds.tMargin}.</p></Card>
    <div className={`rounded-lg border-2 p-3 ${R.box}`}><div className="flex items-center gap-2 text-lg font-extrabold">{cmp.result === 'inconclusive' ? <AlertTriangle /> : <CheckCircle2 />}{R.label}</div>
      <span className="rounded bg-white/70 px-2 py-0.5 text-xs font-bold">{cmp.result === 'inconclusive' ? 'VALID IMAGE' : 'VALID'}</span>
      <p className="mt-2 text-sm"><b>Explanation:</b> {EXPLAIN[cmp.result]}</p><p className="mt-1 text-xs">{cmp.explanation}</p></div>
    {err && <Notice tone="err">{err}</Notice>}
    <Btn onClick={save} disabled={busy}><PenLine size={16} />Save &amp; sign record</Btn>
  </Shell>);
}