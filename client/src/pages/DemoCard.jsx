import { useEffect, useMemo, useState } from 'react';
import { AR } from 'js-aruco2';
import { api } from '../lib/api.js';
import { labToLin, linToSrgb } from '../../../shared/colour.js';
import { Shell, Notice } from '../components/ui.jsx';

const hex = (lab) => '#' + labToLin(lab).map((v) => Math.round(Math.min(255, Math.max(0, linToSrgb(Math.min(1, Math.max(0, v)))))).toString(16).padStart(2, '0')).join('');
export default function DemoCard() {
  const [cfg, setCfg] = useState(null), [fill, setFill] = useState('positive');
  useEffect(() => { api.config().then(setCfg); }, []);
  const svg = useMemo(() => {
    if (!cfg?.demo) return '';
    const { card, kits } = cfg, dic = new AR.Dictionary(card.dictionary), k = kits.scott, [x0, y0, x1, y1] = card.bounds;
    const refs = Object.fromEntries(k.references.map((r) => [r.outcome, r.lab])), mid = refs.positive.map((v, i) => (v + refs.negative[i]) / 2);
    const lab = { positive: refs.positive, negative: refs.negative, between: mid }[fill], ta = card.testArea, pad = (dic.markSize + 2) / dic.markSize;
    const markers = card.markers.map((m) => { const [a, b] = m.corners, side = b[0] - a[0], t = side * pad, o = (t - side) / 2; return `<svg x="${a[0] - o}" y="${a[1] - o}" width="${t}" height="${t}" viewBox="0 0 ${dic.markSize + 2} ${dic.markSize + 2}">${dic.generateSVG(m.id).replace(/^<svg[^>]*>/, '').replace('</svg>', '')}</svg>`; }).join('');
    const patches = card.patches.map((p) => `<rect x="${p.center[0] - p.size[0] / 2}" y="${p.center[1] - p.size[1] / 2}" width="${p.size[0]}" height="${p.size[1]}" fill="${hex(p.lab)}"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" style="width:100%;background:#fff"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fff"/>${markers}${patches}<rect x="${ta.center[0] - ta.size[0] / 2}" y="${ta.center[1] - ta.size[1] / 2}" width="${ta.size[0]}" height="${ta.size[1]}" fill="${hex(lab)}"/><text x="50" y="14" font-size="5" text-anchor="middle" fill="#b45309" font-family="sans-serif">DEMO CARD – NOT MEASURED</text></svg>`;
  }, [cfg, fill]);
  if (cfg && !cfg.demo) return <Shell title="Demo Card"><Notice tone="warn">Demo mode is off. Set DEMO_MODE=on in server/.env.</Notice></Shell>;
  return (<Shell title="Demo Card">
    <Notice tone="warn" title="Demo only">Show this on a second screen (max brightness, no glare) or print it, then run a New Field Test on it. Colours are placeholders, so outcomes only demonstrate the flow.</Notice>
    <div className="flex gap-2 text-xs">{['positive', 'between', 'negative'].map((k) => <button key={k} onClick={() => setFill(k)} className={`flex-1 rounded border px-2 py-2 font-bold uppercase ${fill === k ? 'border-brand bg-brand text-white' : 'border-line'}`}>{k}-like</button>)}</div>
    <div className="rounded border border-line" dangerouslySetInnerHTML={{ __html: svg }} />
  </Shell>);
}
