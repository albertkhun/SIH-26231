import { readFileSync } from 'node:fs';
const load = (f) => JSON.parse(readFileSync(new URL(`./config/${f}`, import.meta.url), 'utf8'));
export const DEMO = process.env.DEMO_MODE === 'on';
export const getConfig = () => {
  if (DEMO) { const d = load('demo.json'); return { kits: d.kits, card: d.card, quality: d.quality, demo: true }; }
  return { kits: load('kits.json'), card: load('card.json'), quality: load('quality.json'), demo: false };
};
const isLab = (l) => Array.isArray(l) && l.length === 3 && l.every(Number.isFinite);
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
// Lists every value still missing before a result may be produced. Nothing is defaulted.
export function configStatus({ kits, card, quality }) {
  const missing = [];
  for (const [k, v] of Object.entries(quality)) if (!k.startsWith('_') && !Number.isFinite(v)) missing.push(`quality.${k}`);
  if (!card.dictionary) missing.push('card.dictionary');
  if (!Array.isArray(card.bounds) || card.bounds.length !== 4 || !card.bounds.every(Number.isFinite)) missing.push('card.bounds');
  if (!(card.markers?.length >= 4) || !card.markers.every((m) => Number.isInteger(m.id) && m.corners?.length === 4 && m.corners.every(isPt))) missing.push('card.markers (need >= 4 with id + 4 corners)');
  if (!card.testArea || !isPt(card.testArea.center) || !isPt(card.testArea.size)) missing.push('card.testArea {center,size}');
  const ps = card.patches || [];
  if (!ps.length || !ps.every((p) => isPt(p.center) && isPt(p.size))) missing.push('card.patches (centre,size)');
  const labs = ps.filter((p) => isLab(p.lab)).length;
  if (labs < 4 && !ps.some((p) => p.role === 'white')) missing.push('card.patches[].lab (>= 4 measured) or a patch with role "white" for fallback');
  for (const [id, kit] of Object.entries(kits)) {
    if (id.startsWith('_')) continue;
    kit.references.forEach((r, i) => { if (!isLab(r.lab)) missing.push(`kits.${id}.references[${i}].lab`); });
    for (const t of ['tClose', 'tMargin']) if (!Number.isFinite(kit.thresholds[t])) missing.push(`kits.${id}.thresholds.${t}`);
  }
  return { ready: missing.length === 0, missing };
}
// Per-kit readiness (kit refs/thresholds) + global (card/quality)
export function kitReady(cfg, kitId) {
  const { missing } = configStatus(cfg);
  return !missing.some((m) => !m.startsWith('kits.') || m.startsWith(`kits.${kitId}.`));
}
