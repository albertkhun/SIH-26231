import test from 'node:test';
import assert from 'node:assert/strict';
import { deltaE2000, linToLab, labToLin, srgbToLin, fitCCM, applyCCM, homography } from './colour.js';
import { canonicalize } from './canonical.js';
test('dE2000 identity and symmetry', () => {
  assert.equal(deltaE2000([50, 10, -5], [50, 10, -5]), 0);
  const a = [52, 38, 21], b = [60, -10, 30];
  assert.ok(Math.abs(deltaE2000(a, b) - deltaE2000(b, a)) < 1e-9);
});
test('Lab round trip', () => {
  const lin = [0.2, 0.4, 0.1], back = labToLin(linToLab(lin));
  lin.forEach((v, i) => assert.ok(Math.abs(v - back[i]) < 1e-6));
  assert.ok(Math.abs(linToLab([1, 1, 1])[0] - 100) < 1e-3);
  assert.ok(Math.abs(srgbToLin(255) - 1) < 1e-9);
});
test('CCM recovers a known linear transform (synthetic maths check only)', () => {
  const T = ([r, g, b]) => [0.9 * r + 0.1 * g, 0.8 * g + 0.05, 1.1 * b];
  const meas = [[.1,.2,.3],[.5,.1,.2],[.3,.7,.1],[.9,.8,.7],[.2,.2,.9],[.6,.4,.5]];
  const ccm = fitCCM(meas, meas.map(T));
  applyCCM(ccm, [.4, .4, .4]).forEach((v, i) => assert.ok(Math.abs(v - T([.4, .4, .4])[i]) < 1e-6));
});
test('homography maps source points', () => {
  const src = [[0,0],[10,0],[10,10],[0,10]], dst = [[5,5],[105,8],[100,110],[2,95]];
  const f = homography(src, dst);
  src.forEach((p, i) => { const q = f(...p); assert.ok(Math.hypot(q[0]-dst[i][0], q[1]-dst[i][1]) < 1e-6); });
});
test('canonical JSON is key-order independent', () => assert.equal(canonicalize({ b: 1, a: [2, { d: 1, c: 2 }] }), canonicalize({ a: [2, { c: 2, d: 1 }], b: 1 })));
