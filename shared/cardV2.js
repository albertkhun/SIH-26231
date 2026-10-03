// ChromaProof v2 reference sheet: single source of truth for the printable artwork AND the geometry in card.json.
// Units are arbitrary but proportions must be kept when printing (print at 100% / "actual size"; any uniform scale works).
// Layout: 4 ArUco markers at the sheet corners, 4x3 colour-patch grid (left), cassette placement panel with a
// target circle (right). The sample spot is centred on the target circle; that region is measured.
export const CARD_V2 = {
  cardId: 'CPV2-001', dictionary: 'ARUCO_MIP_36h12', bounds: [0, 0, 190, 120], markerSize: 16,
  markers: [{ id: 0, x: 6, y: 6 }, { id: 1, x: 168, y: 6 }, { id: 2, x: 168, y: 98 }, { id: 3, x: 6, y: 98 }], // TL, TR, BR, BL
  // Nominal sRGB used only to DRAW the patches. Real calibration needs Lab MEASURED from the printed sheet.
  patches: [
    ['Dark grey', [59, 59, 59]], ['Mid grey', [107, 114, 128]], ['Light grey', [170, 178, 185]], ['White', [255, 255, 255], 'white'],
    ['Blue', [31, 79, 191]], ['Cyan', [23, 166, 216]], ['Green', [46, 158, 79]], ['Yellow', [242, 210, 27]],
    ['Red', [196, 38, 46]], ['Pink', [232, 98, 159]], ['Purple', [122, 74, 125]], ['Brown', [107, 66, 38]],
  ].map(([name, srgb, role], i) => ({ name, srgb, role: role || 'colour', center: [24 + (i % 4) * 24, 39 + Math.floor(i / 4) * 18], size: [20, 14] })),
  frame: { x: 118, y: 26, w: 62, h: 70 }, target: { center: [149, 61], r: 5 }, testArea: { center: [149, 61], size: [6, 6] },
};
export const markerCorners = (m, s = CARD_V2.markerSize) => [[m.x, m.y], [m.x + s, m.y], [m.x + s, m.y + s], [m.x, m.y + s]]; // clockwise from top-left

// markerSvg(id) -> inner SVG markup of a marker whose viewBox is (markSize+2)^2 (1-cell white border), e.g. from js-aruco2 generateSVG.
export function buildSheetSvg(markerSvg, markSize, { bead = null } = {}) {
  const C = CARD_V2, [, , W, H] = C.bounds, pad = (markSize + 2) / markSize, t = C.markerSize * pad, o = (t - C.markerSize) / 2, rgb = (c) => `rgb(${c.join(',')})`;
  const markers = C.markers.map((m) => `<svg x="${m.x - o}" y="${m.y - o}" width="${t}" height="${t}" viewBox="0 0 ${markSize + 2} ${markSize + 2}">${markerSvg(m.id)}</svg>`).join('');
  const patches = C.patches.map((p) => `<rect x="${p.center[0] - 10}" y="${p.center[1] - 7}" width="20" height="14" fill="${rgb(p.srgb)}" stroke="#999" stroke-width="0.2"/>`).join('');
  const f = C.frame, [tx, ty] = C.target.center, tx_ = `font-family="Arial,Helvetica,sans-serif" fill="#111"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm"><rect width="${W}" height="${H}" fill="#fff"/>${markers}
<text x="95" y="13" font-size="6" font-weight="700" text-anchor="middle" ${tx_}>ChromaProof v2</text><text x="95" y="19" font-size="3.2" text-anchor="middle" ${tx_}>Calibration Reference Card</text><text x="95" y="24" font-size="2.8" text-anchor="middle" ${tx_}>Card ID: ${C.cardId}</text>
${patches}<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="2" fill="none" stroke="#1565c0" stroke-width="0.5" stroke-dasharray="2 1.5"/>
<text x="${f.x + f.w / 2}" y="${f.y + 5}" font-size="3" font-weight="700" text-anchor="middle" fill="#1565c0" font-family="Arial,sans-serif">PLACE TEST CASSETTE HERE</text>
<circle cx="${tx}" cy="${ty}" r="${C.target.r}" fill="${bead ? rgb(bead) : 'none'}" stroke="#1565c0" stroke-width="0.5"/>
<text x="${f.x + f.w / 2}" y="${f.y + f.h - 3}" font-size="2.4" text-anchor="middle" fill="#1565c0" font-family="Arial,sans-serif">Centre the sample spot on the circle</text>
<text x="14" y="95" font-size="2.8" ${tx_}>ChromaProof v2 · Reference Card · Use with Scott's / Simon's kits</text><text x="14" y="99.5" font-size="2.4" ${tx_}>${C.cardId}</text></svg>`;
}