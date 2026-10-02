import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { processFrame, readout } from '../lib/analyse.js';
import { Shell, Card, Btn, Notice } from '../components/ui.jsx';

const num = (v) => (v === '' || v == null ? NaN : Number(v)), f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
const PARAMS = [['warpWidthPx', 'warpWidthPx (flattened card width, px)'], ['saturationLevel', 'saturationLevel (0–255, all channels ≥)'], ['clipLowLevel', 'clipLowLevel (luma ≤)'], ['clipHighLevel', 'clipHighLevel (luma ≥)']];
export default function Calibrate() {
  const video = useRef(), busy = useRef(false), [cfg, setCfg] = useState(null), [par, setPar] = useState({}), [out, setOut] = useState(null), [camErr, setCamErr] = useState(''), [copied, setCopied] = useState(false);
  useEffect(() => { api.config().then((c) => { setCfg(c); setPar(Object.fromEntries(PARAMS.map(([k]) => [k, c.quality[k] ?? '']))); }); }, []);
  useEffect(() => {
    let s; navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((st) => { s = st; video.current.srcObject = st; video.current.play(); }).catch((e) => setCamErr(`Camera unavailable: ${e.message}`));
    return () => s?.getTracks().forEach((t) => t.stop());
  }, []);
  const c = cfg?.card, geomOk = c && c.dictionary && c.bounds && c.markers?.length >= 4 && c.testArea;
  const q = Object.fromEntries(PARAMS.map(([k]) => [k, num(par[k])]));
  const qRef = useRef(q); qRef.current = q;
  useEffect(() => {
    if (!geomOk) return;
    let stop = false;
    (async () => { while (!stop) { const v = video.current; if (v?.videoWidth && !busy.current) { busy.current = true;
      try { const p = processFrame(v, { card: c, quality: qRef.current }); setOut({ p, ro: p.warped ? readout(p, c) : null }); } catch { /* skip frame */ } busy.current = false; } await new Promise((r) => setTimeout(r, 700)); } })();
    return () => { stop = true; };
  }, [geomOk]); // eslint-disable-line
  const p = out?.p, ro = out?.ro, inp = 'w-full rounded border border-line px-2 py-1.5 text-sm';
  const copy = async () => { await navigator.clipboard?.writeText(JSON.stringify({ params: q, markers: `${p.detected}/${p.expected}`, blurLaplacianVar: p.blurVar, glareFraction: p.glareFraction, clippedFraction: p.clippedFraction, tiltDeg: p.tiltDeg, readout: ro }, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (<Shell title="Calibration Mode">
    <Notice title="Measurement aid">Shows raw numbers so you can derive config values. No thresholds are applied and nothing is saved. Take several good and several bad captures and note the values.</Notice>
    {cfg && !geomOk && <Notice tone="warn" title="Card geometry missing">Set <code>card.dictionary, bounds, markers, testArea</code> in <code>card.json</code> first (or use DEMO_MODE). <Link to="/" className="underline">Back</Link></Notice>}
    <div className="overflow-hidden rounded-lg border-2 border-brand bg-black"><video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover" /></div>
    {camErr && <Notice tone="err">{camErr}</Notice>}
    <Card title="Analysis parameters (you choose these)"><div className="space-y-1.5">{PARAMS.map(([k, l]) => (
      <label key={k} className="block text-[11px] font-semibold">{l}<input className={inp} inputMode="decimal" value={par[k] ?? ''} onChange={(e) => setPar({ ...par, [k]: e.target.value })} /></label>))}</div>
      <p className="mt-1 text-[11px] text-slate-500">Leave a field blank to skip the metrics that depend on it. Final values go in <code>quality.json</code>.</p></Card>
    {p && (<Card title="Live metrics"><table className="w-full text-sm"><tbody>{[['Markers found', `${p.detected}/${p.expected}`], ['Tilt (approx. °)', f(p.tiltDeg, 1)], ['Blur (Laplacian variance)', f(p.blurVar, 1)], ['Saturated / glare fraction', f(p.glareFraction, 4)], ['Clipped fraction', f(p.clippedFraction, 4)]].map(([k, v]) => <tr key={k} className="border-t border-line"><td className="py-1">{k}</td><td className="py-1 text-right font-mono font-semibold">{v}</td></tr>)}</tbody></table>
      {!p.warped && <p className="mt-1 text-xs text-amber-700">{p.detected < p.expected ? 'Not all markers visible.' : 'Enter warpWidthPx to flatten the card.'}</p>}</Card>)}
    {ro && (<Card title="Colour readings (uncalibrated sRGB → Lab D65)"><table className="w-full text-[11px]"><thead><tr className="text-left text-slate-500"><th>Region</th><th>RGB</th><th>Raw Lab</th><th>Config Lab</th></tr></thead><tbody>
      {[ro.testArea, ...ro.patches].map((r) => <tr key={r.name} className="border-t border-line"><td className="py-1 font-semibold">{r.name}</td><td>{r.rgb.join(', ')}</td><td>{r.rawLab.map((v) => v.toFixed(1)).join(', ')}</td><td>{r.lab ? r.lab.join(', ') : '–'}</td></tr>)}</tbody></table>
      <p className="mt-1 text-[11px] text-slate-500">Measure kit references by photographing the kit's own chart on the card under controlled light, but final reference Lab should come from an instrument.</p></Card>)}
    {p && <Btn outline onClick={copy}>{copied ? 'Copied' : 'Copy snapshot JSON'}</Btn>}
  </Shell>);
}
