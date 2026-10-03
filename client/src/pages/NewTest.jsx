import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Info, CheckCircle2, XCircle, MinusCircle, Timer, RotateCcw, ArrowRight } from 'lucide-react';
import { api, getDevice, store } from '../lib/api.js';
import { processFrame, evaluateQuality, failureReasons, measure } from '../lib/analyse.js';
import { Shell, Card, Btn, Notice, ConfigMissing } from '../components/ui.jsx';

const ICON = { pass: <CheckCircle2 size={16} className="text-emerald-600" />, fail: <XCircle size={16} className="text-red-600" />, na: <MinusCircle size={16} className="text-slate-400" /> };
export default function NewTest() {
  const nav = useNavigate(), video = useRef(), busy = useRef(false);
  const [cfg, setCfg] = useState(null), [kit, setKit] = useState(store.shot?.kit || 'scott'), [sample, setSample] = useState(store.shot?.sample || 'SAMPLE-001');
  const [checks, setChecks] = useState([]), [gps, setGps] = useState({ status: 'pending' }), [camErr, setCamErr] = useState(''), [err, setErr] = useState('');
  const [shot, setShot] = useState(store.shot); // captured frame stays on screen until Retake
  const [timerStart, setTimerStart] = useState(null), [now, setNow] = useState(Date.now());
  const dev = getDevice(), live = !shot;
  useEffect(() => { api.config().then(setCfg).catch((e) => setErr(e.message)); }, []);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => { // GPS
    const w = navigator.geolocation?.watchPosition((p) => setGps({ status: 'recorded', lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }), (e) => setGps({ status: 'unavailable', reason: e.message }), { enableHighAccuracy: true, maximumAge: 5000 });
    return () => { if (w != null) navigator.geolocation.clearWatch(w); };
  }, []);
  useEffect(() => { // live camera only while no captured image is shown; released after capture
    if (!live) return;
    let stream, dead = false; setCamErr('');
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => { if (dead) return s.getTracks().forEach((t) => t.stop()); stream = s; video.current.srcObject = s; video.current.play(); })
      .catch((e) => setCamErr(`Camera unavailable: ${e.message}. HTTPS and camera permission are required.`));
    return () => { dead = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [live]);
  const ready = cfg?.status.ready;
  useEffect(() => { // live quality loop
    if (!ready || !live) return;
    let stop = false;
    (async () => { while (!stop) { const v = video.current; if (v?.videoWidth && !busy.current) { busy.current = true; try { setChecks(evaluateQuality(processFrame(v, cfg), cfg)); } catch { /* ignore frame */ } busy.current = false; } await new Promise((r) => setTimeout(r, 700)); } })();
    return () => { stop = true; };
  }, [ready, live, cfg]);

  const timer = cfg?.kits[kit]?.timer, timed = timer && (timer.minSeconds != null || timer.maxSeconds != null);
  const elapsed = timerStart ? (now - timerStart) / 1000 : null;
  const inWindow = elapsed != null && (timer.minSeconds == null || elapsed >= timer.minSeconds) && (timer.maxSeconds == null || elapsed <= timer.maxSeconds);
  const canCapture = live && ready && dev && !camErr && !(timed && !timerStart) && !!video.current?.videoWidth;
  const update = (s) => { store.shot = s; setShot(s); };

  async function capture() {
    if (!canCapture || busy.current) return;
    setErr('');
    const v = video.current, cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    const capturedAt = Date.now(), blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.95)), url = URL.createObjectURL(blob);
    update({ url, state: 'analysing', kit, sample }); // freeze immediately
    try {
      const p = processFrame(cv, cfg), qc = evaluateQuality(p, cfg), reasons = failureReasons(qc);
      const timing = { startedAt: timerStart ? new Date(timerStart).toISOString() : null, capturedAt: new Date(capturedAt).toISOString(), elapsedSeconds: timerStart ? (capturedAt - timerStart) / 1000 : null };
      if (timed && !inWindow) reasons.push(timerStart ? (elapsed < (timer.minSeconds ?? 0) ? 'Captured too early (before valid window)' : 'Captured too late (after valid window)') : 'Reaction timer was not run');
      const meta = { kit, sampleId: sample, timestamp: new Date(capturedAt).toISOString(), gps, timing, quality: Object.fromEntries(qc.map((c) => [c.id, { value: c.value, status: c.status }])) };
      if (reasons.length) { // failed attempts are logged and chained
        const out = await api.save(blob, { ...meta, invalidReasons: reasons });
        update({ url, state: 'invalid', reasons, recordId: out.recordId, kit, sample }); return;
      }
      const m = measure(p, cfg);
      store.pending = { blob, url, meta: { ...meta, calibration: m.calibration, measurement: { lab: m.lab }, invalidReasons: [] } };
      update({ url, state: 'valid', kit, sample });
      nav('/analysis');
    } catch (e) { setErr(e.message); update({ url, state: 'error', kit, sample }); }
  }
  const retake = () => { store.pending = null; update(null); setTimerStart(null); setChecks([]); setErr(''); };
  const inp = 'w-full rounded border border-line bg-white px-2 py-2 text-sm';
  return (<Shell title="New Field Test">
    {!dev && <Notice tone="err">Device not enrolled. <Link className="underline" to="/">Enrol on the Test Log screen.</Link></Notice>}
    {cfg && !ready && <ConfigMissing missing={cfg.status.missing} />}
    <Card><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold">Kit Type<select disabled={!live} className={inp} value={kit} onChange={(e) => { setKit(e.target.value); setTimerStart(null); }}>
      {cfg && Object.entries(cfg.kits).filter(([k]) => !k.startsWith('_')).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
      <label className="text-xs font-bold">Sample ID<input disabled={!live} className={inp} value={sample} onChange={(e) => setSample(e.target.value)} /></label></div></Card>

    <div onClick={capture} role="button" aria-label="Tap to capture" className={`relative overflow-hidden rounded-lg border-2 bg-black ${shot?.state === 'invalid' ? 'border-red-500' : 'border-brand'} ${canCapture ? 'cursor-pointer' : ''}`}>
      {live ? <video ref={video} playsInline muted className="aspect-[3/4] w-full object-cover" /> : <img src={shot.url} alt="Captured test" className="aspect-[3/4] w-full object-cover" />}
      {live && <><div className="pointer-events-none absolute inset-6 rounded border-2 border-dashed border-white/80" />
        <span className="absolute left-2 top-2 rounded bg-brand px-2 py-0.5 text-xs font-bold text-white">REFERENCE CARD + TEST AREA</span>
        {canCapture && <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Tap to capture</span>}</>}
      {shot && <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{shot.state === 'analysing' ? 'ANALYSING…' : 'CAPTURED IMAGE'}</span>}
    </div>
    {camErr && <Notice tone="err">{camErr}</Notice>}
    {err && <Notice tone="err">{err}</Notice>}

    {shot?.state === 'analysing' && <Notice title="Analysing capture…">Perspective correction, colour calibration and measurement in progress.</Notice>}
    {shot?.state === 'invalid' && (<Notice tone="err" title="Invalid capture">The image cannot be measured reliably. Attempt logged as {shot.recordId}.
      <ul className="my-1 list-disc pl-5">{shot.reasons.map((r) => <li key={r}>{r}</li>)}</ul></Notice>)}
    {shot?.state === 'valid' && <Notice tone="ok" title="Image captured">Measurement complete. Review the analysis or retake the image.</Notice>}
    {shot && shot.state !== 'analysing' && (<div className="space-y-2">
      {shot.state === 'valid' && <Btn onClick={() => nav('/analysis')}><ArrowRight size={16} />View analysis</Btn>}
      <Btn outline onClick={retake}><RotateCcw size={16} />Retake image</Btn></div>)}

    {live && (<>
      <Card title="Reaction timer" icon={Timer}>{timed ? (<div className="space-y-2 text-sm">
        <div>Valid window: {timer.minSeconds ?? 0}s – {timer.maxSeconds ?? '∞'}s after reagent</div>
        <div className={`text-3xl font-extrabold ${timerStart ? (inWindow ? 'text-emerald-700' : 'text-amber-600') : 'text-slate-400'}`}>{timerStart ? elapsed.toFixed(1) + ' s' : '–'}</div>
        <Btn outline onClick={() => setTimerStart(Date.now())}>{timerStart ? 'Restart timer' : 'Start timer (reagent applied)'}</Btn></div>)
        : <p className="text-sm text-slate-600">No timing window is configured for this kit (<code>kits.{kit}.timer</code>), so none is enforced.</p>}</Card>
      <Card title="Live capture quality" icon={Camera}><div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {(checks.length ? checks : [{ id: 'x', label: ready ? 'Searching for card…' : 'Needs configuration', status: 'na', value: '' }]).map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-1"><span>{c.label}</span><span className="flex items-center gap-1 text-xs">{c.value}{ICON[c.status]}</span></div>))}</div>
        <div className="mt-2 text-xs text-slate-600">GPS: {gps.status === 'recorded' ? `±${gps.accuracyM} m` : gps.status}</div></Card>
      <Btn onClick={capture} disabled={!canCapture}><Camera size={18} />Capture test result</Btn>
      <p className="flex items-center gap-2 text-xs text-brand"><Info size={14} />Live camera capture required. Gallery images are not accepted.</p></>)}
  </Shell>);
}