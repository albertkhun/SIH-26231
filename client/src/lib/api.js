const B = import.meta.env.VITE_API_BASE || '';
const j = async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(d.error || r.statusText), d); return d; };
const post = (u, body) => fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(j);
export const getDevice = () => JSON.parse(localStorage.getItem('cp_device') || 'null');
export const api = {
  config: () => fetch(B + '/api/config').then(j),
  enrol: async (operatorId, enrolCode) => { const d = await post(B + '/api/devices/enrol', { operatorId, enrolCode }); localStorage.setItem('cp_device', JSON.stringify(d)); return d; },
  list: (p) => fetch(B + '/api/records?' + new URLSearchParams(Object.entries(p).filter(([, v]) => v))).then(j),
  record: (id) => fetch(`${B}/api/records/${encodeURIComponent(id)}`).then(j),
  verify: (id, file) => { if (!file) return fetch(`${B}/api/verify/${encodeURIComponent(id)}`).then(j); const f = new FormData(); f.append('image', file); return fetch(`${B}/api/verify/${encodeURIComponent(id)}`, { method: 'POST', body: f }).then(j); },
  tamper: (id, field) => post(`${B}/api/demo/tamper/${encodeURIComponent(id)}`, { field }),
  restore: (id) => post(`${B}/api/demo/restore/${encodeURIComponent(id)}`, {}),
  save: (blob, meta) => { const f = new FormData(); f.append('image', blob, 'capture.jpg'); f.append('meta', JSON.stringify(meta)); return fetch(B + '/api/records', { method: 'POST', headers: { 'x-device-token': getDevice()?.token || '' }, body: f }).then(j); },
};
export const imageUrl = (id) => `${B}/api/records/${encodeURIComponent(id)}/image?t=${Date.now()}`;
export const store = { pending: null, shot: null }; // pending: valid capture awaiting save; shot: last captured frame kept on screen until Retake