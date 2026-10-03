import { useEffect, useMemo, useState } from 'react';
import { AR } from 'js-aruco2';
import { Download, Printer } from 'lucide-react';
import { api } from '../lib/api.js';
import { CARD_V2 } from '../../../shared/cardV2.js';
import { buildSheetSvg } from '../../../shared/cardV2.js';
import { Shell, Notice, Btn } from '../components/ui.jsx';

// On-screen sample spot colours for DEMO mode only (the guide's example pink / purple / yellow).
const BEADS = { positive: [236, 60, 190], between: [160, 85, 200], negative: [242, 205, 20] };
export default function CardPage() {
  const [cfg, setCfg] = useState(null), [bead, setBead] = useState(null);
  useEffect(() => { api.config().then(setCfg); }, []);
  const build = (b) => { const d = new AR.Dictionary(CARD_V2.dictionary); return buildSheetSvg((id) => d.generateSVG(id).replace(/^<svg[^>]*>/, '').replace('</svg>', ''), d.markSize, { bead: b }); };
  const preview = useMemo(() => build(cfg?.demo ? BEADS[bead] : null).replace(/ width="[\d.]+mm" height="[\d.]+mm"/, ' style="width:100%;height:auto"'), [cfg, bead]); // eslint-disable-line
  const svg = useMemo(() => build(null), []);
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = `ChromaProof-${CARD_V2.cardId}.svg`; a.click(); };
  const print = () => { const w = window.open('', '_blank'); w.document.write(`<html><body style="margin:0">${svg}</body></html>`); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); };
  return (<Shell title="Reference Card">
    <Notice title="Print instructions">Print at <b>100% / actual size</b> (no "fit to page"), on matte paper, landscape. Any uniform scale works as long as the proportions are kept. Do not crop the white border around each black marker.</Notice>
    {cfg?.demo ? <Notice tone="warn" title="Demo only">To try it without a printout, show this on a second screen at full brightness and pick a sample spot colour below. Colours are placeholders.</Notice>
      : <Notice>Place the test cassette in the dashed panel with the sample spot centred on the circle. Patch colours must be <b>measured from your printed sheet</b> (see Calibrate) before relying on absolute colour values.</Notice>}
    {cfg?.demo && <div className="flex gap-2 text-xs">{['positive', 'between', 'negative'].map((k) => <button key={k} onClick={() => setBead(k)} className={`flex-1 rounded border px-2 py-2 font-bold uppercase ${bead === k ? 'border-brand bg-brand text-white' : 'border-line'}`}>{k === 'between' ? 'borderline' : k}</button>)}</div>}
    <div className="rounded border border-line" dangerouslySetInnerHTML={{ __html: preview }} />
    <div className="grid grid-cols-2 gap-2"><Btn outline onClick={download}><Download size={16} />Download SVG</Btn><Btn onClick={print}><Printer size={16} />Print</Btn></div>
  </Shell>);
}