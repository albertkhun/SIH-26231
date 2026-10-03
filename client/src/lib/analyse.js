import { AR } from 'js-aruco2';
import { homography, srgbToLin, linToLab, labToLin, deltaE2000, median, fitCCM, applyCCM } from '../../../shared/colour.js';

const MAX_SIDE = 1280; // analysis resolution (thresholds in quality.json depend on this + warpWidthPx)
const detectors = {};
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clampLin = (v) => v.map((x) => Math.min(Math.max(x, 0), 1.5));

function sample(src, w, h, x, y, out, o) { // bilinear
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) { out[o] = out[o + 1] = out[o + 2] = 0; out[o + 3] = 255; return; }
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1), fx = x - x0, fy = y - y0;
  for (let c = 0; c < 3; c++) {
    const a = src[(y0 * w + x0) * 4 + c], b = src[(y0 * w + x1) * 4 + c], d = src[(y1 * w + x0) * 4 + c], e = src[(y1 * w + x1) * 4 + c];
    out[o + c] = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + d * (1 - fx) * fy + e * fx * fy;
  }
  out[o + 3] = 255;
}

// Detect markers, fit homography (card -> image), flatten card, compute quality metrics.
export function processFrame(source, cfg) {
  const { card, quality: q } = cfg;
  const sw = source.videoWidth || source.width, sh = source.videoHeight || source.height, k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.round(sw * k), h = Math.round(sh * k), cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const det = (detectors[card.dictionary] ||= new AR.Detector({ dictionaryName: card.dictionary }));
  const byId = Object.fromEntries(det.detect(img).map((m) => [m.id, m]));
  const found = card.markers.filter((m) => byId[m.id]);
  const out = { detected: found.length, expected: card.markers.length, width: w, height: h };
  if (found.length < card.markers.length) return out;
  const src = found.flatMap((m) => m.corners), dst = found.flatMap((m) => byId[m.id].corners.map((c) => [c.x, c.y]));
  const map = homography(src, dst), [x0, y0, x1, y1] = card.bounds;
  const quad = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map((p) => map(...p));
  out.inFrame = quad.every(([x, y]) => x >= 0 && y >= 0 && x <= w && y <= h);
  const r1 = Math.min(dist(quad[0], quad[1]), dist(quad[3], quad[2])) / Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]));
  const r2 = Math.min(dist(quad[0], quad[3]), dist(quad[1], quad[2])) / Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]));
  out.tiltDeg = (Math.acos(Math.min(r1, r2, 1)) * 180) / Math.PI; // approximate foreshortening angle
  if (!Number.isFinite(q.warpWidthPx)) return out; // calibration mode: warp size not yet chosen
  const WW = q.warpWidthPx, s = WW / (x1 - x0), WH = Math.round((y1 - y0) * s), data = new Uint8ClampedArray(WW * WH * 4);
  for (let v = 0; v < WH; v++) for (let u = 0; u < WW; u++) { const [px, py] = map(x0 + u / s, y0 + v / s); sample(img.data, w, h, px, py, data, (v * WW + u) * 4); }
  out.warped = { data, width: WW, height: WH, s, x0, y0 };
  Object.assign(out, metrics(out.warped, card, q));
  return out;
}

const rect = (wp, c, sz) => ({ x: Math.max(0, Math.round((c[0] - sz[0] / 2 - wp.x0) * wp.s)), y: Math.max(0, Math.round((c[1] - sz[1] / 2 - wp.y0) * wp.s)), w: Math.max(1, Math.round(sz[0] * wp.s)), h: Math.max(1, Math.round(sz[1] * wp.s)) });
function* pixels(wp, r) { for (let y = r.y; y < Math.min(r.y + r.h, wp.height); y++) for (let x = r.x; x < Math.min(r.x + r.w, wp.width); x++) yield (y * wp.width + x) * 4; }
function regionRGB(wp, r) { const ch = [[], [], []]; for (const i of pixels(wp, r)) for (let c = 0; c < 3; c++) ch[c].push(wp.data[i + c]); return ch.map(median); }

function metrics(wp, card, q) {
  const { width: W, height: H, data: d } = wp, g = new Float32Array(W * H);
  let sat = 0, clip = 0;
  for (let i = 0; i < W * H; i++) {
    const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], y = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    g[i] = y; if (r >= q.saturationLevel && gg >= q.saturationLevel && b >= q.saturationLevel) sat++;
    if (y <= q.clipLowLevel || y >= q.clipHighLevel) clip++;
  }
  let s1 = 0, s2 = 0, n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - W] - g[i + W]; s1 += l; s2 += l * l; n++; }
  let tSat = 0, tN = 0; const ta = rect(wp, card.testArea.center, card.testArea.size);
  for (const i of pixels(wp, ta)) { tN++; if (d[i] >= q.saturationLevel && d[i + 1] >= q.saturationLevel && d[i + 2] >= q.saturationLevel) tSat++; }
  const ok = (v) => Number.isFinite(v); // levels left blank in calibration mode -> metric reported as NaN
  return { blurVar: s2 / n - (s1 / n) ** 2, glareFraction: ok(q.saturationLevel) ? Math.max(sat / (W * H), tN ? tSat / tN : 0) : NaN, clippedFraction: ok(q.clipLowLevel) && ok(q.clipHighLevel) ? clip / (W * H) : NaN };
}

// Pass/fail per check against config thresholds. 'na' = could not be computed (card not found).
export function evaluateQuality(p, cfg) {
  const q = cfg.quality, ok = (cond) => (cond ? 'pass' : 'fail'), has = !!p.warped;
  return [
    { id: 'reference', label: 'Reference Card', value: `${p.detected}/${p.expected} markers`, status: ok(p.detected === p.expected) },
    { id: 'framing', label: 'Test Area', value: has ? (p.inFrame ? 'inside frame' : 'cut off') : '–', status: has ? ok(p.inFrame) : 'na' },
    { id: 'focus', label: 'Focus', value: has ? p.blurVar.toFixed(1) : '–', threshold: `≥ ${q.blurLaplacianVarMin}`, status: has ? ok(p.blurVar >= q.blurLaplacianVarMin) : 'na' },
    { id: 'exposure', label: 'Exposure', value: has ? (p.clippedFraction * 100).toFixed(1) + '% clipped' : '–', threshold: `≤ ${q.clippedFractionMax * 100}%`, status: has ? ok(p.clippedFraction <= q.clippedFractionMax) : 'na' },
    { id: 'glare', label: 'Glare', value: has ? (p.glareFraction * 100).toFixed(1) + '% saturated' : '–', threshold: `≤ ${q.glareSaturatedFractionMax * 100}%`, status: has ? ok(p.glareFraction <= q.glareSaturatedFractionMax) : 'na' },
    { id: 'alignment', label: 'Alignment', value: has ? p.tiltDeg.toFixed(1) + '° skew' : '–', threshold: `≤ ${q.tiltDegMax}°`, status: has ? ok(p.tiltDeg <= q.tiltDegMax) : 'na' },
  ];
}
export const failureReasons = (checks) => (checks.find((c) => c.id === 'reference')?.status === 'fail' ? checks.filter((c) => c.id === 'reference') : checks.filter((c) => c.status !== 'pass')).map((c) => ({ reference: 'Reference card is not fully visible', framing: 'Test area / card not fully inside frame', focus: 'Insufficient focus (blur)', exposure: 'Poor exposure (clipping)', glare: 'Excessive glare', alignment: 'Incorrect alignment (excess tilt)' }[c.id]));

// Calibrate with the card, measure the kit region, return CIELAB. Mean card-patch dE00 is in-sample (fit residual).
export function measure(p, cfg) {
  const { card } = cfg, wp = p.warped;
  const patches = card.patches.map((pt) => ({ ...pt, lin: regionRGB(wp, rect(wp, pt.center, pt.size)).map(srgbToLin) }));
  const test = regionRGB(wp, rect(wp, card.testArea.center, card.testArea.size)).map(srgbToLin);
  const withLab = patches.filter((x) => Array.isArray(x.lab));
  let cal, corrected;
  if (withLab.length >= 4) {
    const ccm = fitCCM(withLab.map((x) => x.lin), withLab.map((x) => labToLin(x.lab)));
    const mean = (f) => withLab.reduce((a, x) => a + deltaE2000(f(x), x.lab), 0) / withLab.length;
    cal = { mode: 'ccm-3x4', patchesUsed: withLab.length, deltaEBefore: mean((x) => linToLab(clampLin(x.lin))), deltaEAfter: mean((x) => linToLab(clampLin(applyCCM(ccm, x.lin)))) };
    corrected = applyCCM(ccm, test);
  } else {
    const wht = patches.find((x) => x.role === 'white'), m = (wht.lin[0] + wht.lin[1] + wht.lin[2]) / 3;
    cal = { mode: 'white-balance-only', patchesUsed: 1, deltaEBefore: null, deltaEAfter: null };
    corrected = test.map((v, i) => (v * m) / wht.lin[i]);
  }
  const lab = linToLab(clampLin(corrected));
  if (!lab.every(Number.isFinite)) throw new Error('Measurement failed');
  return { calibration: cal, lab };
}

// Raw readings for calibration mode: median sRGB + uncalibrated CIELAB (D65) of each card patch and the test area.
export function readout(p, card) {
  const wp = p.warped, one = (name, c, sz, lab) => { const rgb = regionRGB(wp, rect(wp, c, sz)); return { name, rgb: rgb.map((v) => Math.round(v)), rawLab: linToLab(rgb.map(srgbToLin)), lab: lab || null }; };
  return { testArea: one('Test area', card.testArea.center, card.testArea.size), patches: (card.patches || []).map((x) => one(x.name || '?', x.center, x.size, x.lab)) };
}