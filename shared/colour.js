// Colour science: sRGB <-> linear <-> XYZ(D65) <-> CIELAB, CIEDE2000, least-squares helpers.
const WHITE_D65 = [0.95047, 1, 1.08883];
const M = [[0.4124564,0.3575761,0.1804375],[0.2126729,0.7151522,0.0721750],[0.0193339,0.1191920,0.9503041]];
const Mi = [[3.2404542,-1.5371385,-0.4985314],[-0.9692660,1.8760108,0.0415560],[0.0556434,-0.2040259,1.0572252]];
const rad = Math.PI / 180;

export const srgbToLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const linToSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const mul = (m, v) => m.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

export function linToLab(lin) {
  const xyz = mul(M, lin).map((v, i) => v / WHITE_D65[i]);
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToLin([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  return mul(Mi, [inv(fx), inv(fy), inv(fz)].map((v, i) => v * WHITE_D65[i]));
}

export function deltaE2000([L1, a1, b1], [L2, a2, b2]) {
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => { const h = Math.atan2(b, a) / rad; return h < 0 ? h + 360 : h; };
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p);
  const dLp = L2 - L1, dCp = C2p - C1p, prod = C1p * C2p;
  let dhp = 0;
  if (prod !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(prod) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (prod !== 0) hbp = Math.abs(h1p - h2p) <= 180 ? hbp / 2 : hbp < 360 ? (hbp + 360) / 2 : (hbp - 360) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  const x = dCp / Sc, y = dHp / Sh;
  return Math.sqrt((dLp / Sl) ** 2 + x * x + y * y + Rt * x * y);
}

export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };

// Gaussian elimination with partial pivoting. A: n x n, b: n.
export function solveLinear(A, b) {
  const n = b.length, m = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) throw new Error('Singular system');
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) { const f = m[r][c] / m[c][c]; for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k]; }
  }
  const x = new Array(n);
  for (let r = n - 1; r >= 0; r--) { let s = m[r][n]; for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k]; x[r] = s / m[r][r]; }
  return x;
}
// Least squares via normal equations: minimise |A w - t|.
export function lstsq(A, t) {
  const k = A[0].length, AtA = Array.from({ length: k }, () => new Array(k).fill(0)), Att = new Array(k).fill(0);
  A.forEach((row, i) => row.forEach((v, a) => { Att[a] += v * t[i]; row.forEach((w, b) => (AtA[a][b] += v * w)); }));
  return solveLinear(AtA, Att);
}
// 3x4 affine colour-correction matrix on linear RGB. measured/target: arrays of [r,g,b].
export function fitCCM(measured, target) {
  const A = measured.map(([r, g, b]) => [r, g, b, 1]);
  return [0, 1, 2].map((ch) => lstsq(A, target.map((t) => t[ch])));
}
export const applyCCM = (ccm, [r, g, b]) => ccm.map((w) => w[0] * r + w[1] * g + w[2] * b + w[3]);

// Direct linear transform: returns map(x,y)->[u,v] for >=4 point pairs (coords normalised internally).
export function homography(src, dst) {
  const sc = Math.max(...src.flat().map(Math.abs)) || 1, dc = Math.max(...dst.flat().map(Math.abs)) || 1;
  const A = [], t = [];
  src.forEach(([x0, y0], i) => {
    const x = x0 / sc, y = y0 / sc, u = dst[i][0] / dc, v = dst[i][1] / dc;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); t.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); t.push(v);
  });
  const h = lstsq(A, t);
  return (px, py) => {
    const x = px / sc, y = py / sc, w = h[6] * x + h[7] * y + 1;
    return [(dc * (h[0] * x + h[1] * y + h[2])) / w, (dc * (h[3] * x + h[4] * y + h[5])) / w];
  };
}
