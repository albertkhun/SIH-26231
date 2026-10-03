// Writes card geometry into server/config/card.json (real) and demo.json (placeholders). Run: node shared/gen-config.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { CARD_V2 as C, markerCorners } from './cardV2.js';
import { srgbToLin, linToLab } from './colour.js';
const geometry = (withLab) => ({
  cardId: C.cardId, dictionary: C.dictionary, bounds: C.bounds,
  markers: C.markers.map((m) => ({ id: m.id, corners: markerCorners(m) })),
  patches: C.patches.map((p) => ({ name: p.name, role: p.role, center: p.center, size: p.size, lab: withLab ? linToLab(p.srgb.map(srgbToLin)).map((v) => +v.toFixed(2)) : null })),
  testArea: { center: C.testArea.center, size: C.testArea.size },
});
const dir = new URL('../server/config/', import.meta.url);
const real = JSON.parse(readFileSync(new URL('card.json', dir)));
writeFileSync(new URL('card.json', dir), JSON.stringify({ _note: real._note, ...geometry(false) }, null, 1));
const demo = JSON.parse(readFileSync(new URL('demo.json', dir)));
demo.card = geometry(true);
const L = (c) => linToLab(c.map(srgbToLin)).map((v) => +v.toFixed(1));
for (const k of Object.values(demo.kits)) { // DEMO ONLY: references = Lab of the guide's example pink / yellow, thresholds are arbitrary placeholders
  k.references = [{ outcome: 'positive', label: 'Positive', lab: L([236, 60, 190]) }, { outcome: 'negative', label: 'Negative', lab: L([242, 205, 20]) }];
  k.thresholds = { tClose: 10, tMargin: 5 };
} // DEMO ONLY: Lab computed from nominal drawing sRGB, not measured from a print
writeFileSync(new URL('demo.json', dir), JSON.stringify(demo, null, 1));
console.log('card.json + demo.json updated');
