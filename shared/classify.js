import { deltaE2000 } from './colour.js';
// Deterministic, explainable rule from the solution doc (Step 5). Thresholds come from config only.
export function classify(lab, kit) {
  const { tClose, tMargin } = kit.thresholds;
  const refs = kit.references.map((r) => ({ label: r.label, outcome: r.outcome, deltaE: deltaE2000(lab, r.lab) })).sort((a, b) => a.deltaE - b.deltaE);
  const d1 = refs[0].deltaE, d2 = refs[1] ? refs[1].deltaE : null;
  const separation = d2 === null ? null : d2 - d1;
  const ok = d2 !== null && d1 <= tClose && separation >= tMargin;
  return { result: ok ? refs[0].outcome : 'inconclusive', refs, d1, d2, separation, tClose, tMargin,
    explanation: ok ? `ΔE2000 ${d1.toFixed(1)} to ${refs[0].label} reference, ${d2.toFixed(1)} to ${refs[1].label}. Class: ${refs[0].outcome}.`
      : `Evidence is borderline: nearest reference ${refs[0].label} at ΔE2000 ${d1.toFixed(1)}, runner-up separation ${separation === null ? 'n/a' : separation.toFixed(1)}.` };
}
