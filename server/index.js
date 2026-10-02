import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonicalize } from '../shared/canonical.js';
import { classify } from '../shared/classify.js';
import { getConfig, configStatus, kitReady } from './config.js';
import { GENESIS, sha256, recordHashOf, newKeyPair, signPayload, verifyPayload } from './lib.js';
import { Device, Record, Image, DemoBackup, nextN } from './models.js';

const APP_VERSION = 'ChromaProof v1.0.0';
const ENROL_CODE = process.env.ENROL_CODE || '';
const TAMPER_DEMO = process.env.TAMPER_DEMO !== 'off';
const KEY_PROTECTION = 'Server-held software key (MVP; hardware-backed keystore not implemented)';
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(origins.length ? { origin: (o, cb) => cb(null, !o || origins.includes(o) || /^https:\/\/[^/]+:5173$/.test(o)) } : undefined));
app.use(express.json());
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => { console.error(e); res.status(500).json({ error: e.message }); });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.get('/api/config', (req, res) => { const cfg = getConfig(); res.json({ ...cfg, status: configStatus(cfg), appVersion: APP_VERSION, demo: cfg.demo, tamperDemo: TAMPER_DEMO }); });

// ---- Device enrolment / revocation (key lifecycle, simplified) ----
app.post('/api/devices/enrol', wrap(async (req, res) => {
  const { operatorId, enrolCode } = req.body;
  if (!operatorId) return res.status(400).json({ error: 'operatorId required' });
  if (ENROL_CODE && enrolCode !== ENROL_CODE) return res.status(403).json({ error: 'Invalid enrolment code' });
  const kp = newKeyPair(), token = crypto.randomBytes(24).toString('hex');
  const deviceId = `DEV-${String(await nextN('device')).padStart(3, '0')}`;
  await Device.create({ deviceId, operatorId, keyId: kp.keyId, publicKeyPem: kp.publicKeyPem, privateKeyPem: kp.privateKeyPem, tokenHash: sha256(token), enrolledAt: new Date() });
  res.json({ deviceId, operatorId, keyId: kp.keyId, token });
}));
app.post('/api/devices/:id/revoke', wrap(async (req, res) => {
  if (!ENROL_CODE || req.body.adminCode !== ENROL_CODE) return res.status(403).json({ error: 'Supervisor code required (set ENROL_CODE)' });
  const d = await Device.findOneAndUpdate({ deviceId: req.params.id }, { revokedAt: new Date() }, { new: true });
  d ? res.json({ deviceId: d.deviceId, revokedAt: d.revokedAt }) : res.status(404).json({ error: 'Unknown device' });
}));

// ---- Create record (valid, inconclusive or invalid attempts are all chained) ----
app.post('/api/records', upload.single('image'), wrap(async (req, res) => {
  const token = req.get('x-device-token') || '';
  const dev = await Device.findOne({ tokenHash: sha256(token) }).select('+privateKeyPem +tokenHash');
  if (!dev || dev.revokedAt) return res.status(401).json({ error: 'Device not enrolled or key revoked' });
  if (!req.file) return res.status(400).json({ error: 'Live-captured image required' });
  const meta = JSON.parse(req.body.meta || '{}');
  const cfg = getConfig();
  if (!meta.kit || !cfg.kits[meta.kit] || meta.kit.startsWith('_')) return res.status(400).json({ error: 'Unknown kit' });
  if (!kitReady(cfg, meta.kit)) return res.status(409).json({ error: 'Configuration incomplete', missing: configStatus(cfg).missing });
  const kit = cfg.kits[meta.kit];
  const invalidReasons = [...(meta.invalidReasons || [])];
  // Kit-specific timing window enforced server-side from config (not trusted from client).
  const { minSeconds, maxSeconds } = kit.timer;
  const timing = { enforced: minSeconds != null || maxSeconds != null, startedAt: meta.timing?.startedAt ?? null, capturedAt: meta.timing?.capturedAt ?? null, elapsedSeconds: meta.timing?.elapsedSeconds ?? null, minSeconds, maxSeconds };
  if (timing.enforced) {
    const e = timing.elapsedSeconds;
    if (e == null) invalidReasons.push('Reaction timer was not run');
    else if (minSeconds != null && e < minSeconds) invalidReasons.push('Captured too early (before valid window)');
    else if (maxSeconds != null && e > maxSeconds) invalidReasons.push('Captured too late (after valid window)');
  }
  let result = 'invalid', comparison = null;
  if (!invalidReasons.length) {
    if (!Array.isArray(meta.measurement?.lab)) return res.status(400).json({ error: 'measurement.lab required' });
    comparison = classify(meta.measurement.lab, kit); result = comparison.result;
  }
  const last = await Record.findOne({ deviceId: dev.deviceId }).sort({ seq: -1 });
  const seq = last ? last.seq + 1 : 1;
  const recordId = `CP-${new Date().getFullYear()}-${String(await nextN('record')).padStart(6, '0')}`;
  const payload = {
    recordId, seq, prevHash: last ? last.recordHash : GENESIS, deviceId: dev.deviceId, operatorId: dev.operatorId, appVersion: APP_VERSION, demoConfig: cfg.demo,
    kit: meta.kit, sampleId: String(meta.sampleId || ''), timestamp: meta.timestamp, signedAt: new Date().toISOString(),
    gps: meta.gps || { status: 'unavailable' }, imageSha256: sha256(req.file.buffer), imageBytes: req.file.size,
    calibration: meta.calibration || null, measurement: meta.measurement || null, comparison, result, invalidReasons,
    quality: meta.quality || null, timing, signing: { algorithm: 'Ed25519', keyId: dev.keyId, keyProtection: KEY_PROTECTION },
  };
  const signature = signPayload(dev.privateKeyPem, payload), recordHash = recordHashOf(payload, signature);
  await Record.create({ recordId, deviceId: dev.deviceId, seq, keyId: dev.keyId, payload, signature, recordHash, createdAt: new Date() });
  await Image.create({ recordId, contentType: req.file.mimetype, size: req.file.size, data: req.file.buffer });
  res.json({ recordId, result });
}));

// ---- Test log (searchable) ----
app.get('/api/records', wrap(async (req, res) => {
  const { q, kit, result, operator, from, to } = req.query, f = {};
  if (kit) f['payload.kit'] = kit;
  if (result) f['payload.result'] = result;
  if (operator) f['payload.operatorId'] = new RegExp(esc(operator), 'i');
  if (q) f.$or = [{ recordId: new RegExp(esc(q), 'i') }, { 'payload.sampleId': new RegExp(esc(q), 'i') }];
  if (from || to) f['payload.timestamp'] = { ...(from && { $gte: new Date(from).toISOString() }), ...(to && { $lte: new Date(`${to}T23:59:59.999Z`).toISOString() }) };
  const rows = await Record.find(f).sort({ createdAt: -1 }).limit(200).select('recordId payload.kit payload.demoConfig payload.sampleId payload.operatorId payload.result payload.timestamp payload.invalidReasons');
  res.json(rows.map((r) => ({ recordId: r.recordId, ...r.payload })));
}));
app.get('/api/records/:id', wrap(async (req, res) => {
  const r = await Record.findOne({ recordId: req.params.id });
  if (!r) return res.status(404).json({ error: 'Record not found' });
  const d = await Device.findOne({ deviceId: r.deviceId });
  res.json({ recordId: r.recordId, payload: r.payload, signature: r.signature, recordHash: r.recordHash, keyRevokedAt: d?.revokedAt || null });
}));
app.get('/api/records/:id/image', wrap(async (req, res) => {
  const im = await Image.findOne({ recordId: req.params.id });
  if (!im) return res.status(404).end();
  res.type(im.contentType).send(im.data);
}));

// ---- Verification: image hash, signature, key status, chain ----
async function verify(recordId, uploaded) {
  const r = await Record.findOne({ recordId });
  if (!r) return null;
  const p = r.payload, dev = await Device.findOne({ deviceId: r.deviceId });
  const im = uploaded ? { data: uploaded } : await Image.findOne({ recordId });
  const curImg = im ? sha256(im.data) : null, curRec = recordHashOf(p, r.signature);
  const checks = [];
  const imgOk = curImg === p.imageSha256;
  checks.push({ id: 'image', label: 'Image SHA-256 matches', status: imgOk ? 'valid' : 'invalid', text: imgOk ? 'Valid' : im ? 'Mismatch' : 'Image missing' });
  const sigOk = !!dev && verifyPayload(dev.publicKeyPem, p, r.signature) && curRec === r.recordHash;
  checks.push({ id: 'signature', label: 'Digital signature valid', status: sigOk ? 'valid' : 'invalid', text: sigOk ? 'Valid' : 'Invalid' });
  let key = { status: 'valid', text: 'Valid' };
  if (!dev || dev.keyId !== p.signing?.keyId) key = { status: 'invalid', text: 'Unknown key' };
  else if (dev.revokedAt) key = new Date(p.signedAt) > dev.revokedAt ? { status: 'warning', text: 'Revoked key, time unverified' } : { status: 'valid', text: 'Valid (revoked later)' };
  checks.push({ id: 'key', label: 'Key status valid', ...key });
  // Chain: contiguous seq per device and each prevHash equals the stored hash of its predecessor.
  const chain = await Record.find({ deviceId: r.deviceId }).sort({ seq: 1 }).select('seq recordHash payload.prevHash');
  let ch = { status: 'valid', text: 'Valid' }, prev = null;
  for (const c of chain) {
    const expectSeq = prev ? prev.seq + 1 : 1;
    if (c.seq !== expectSeq) { ch = { status: 'warning', text: 'Missing link' }; break; }
    if (c.payload.prevHash !== (prev ? prev.recordHash : GENESIS)) { ch = { status: 'invalid', text: 'Broken link' }; break; }
    prev = c;
  }
  checks.push({ id: 'chain', label: 'Hash chain intact', ...ch });
  const overall = checks.some((c) => c.status === 'invalid') ? 'failed' : checks.some((c) => c.status === 'warning') ? 'warning' : 'verified';
  return { overall, checks, hashes: { imageExpected: p.imageSha256, imageCurrent: curImg, recordExpected: r.recordHash, recordCurrent: curRec },
    summary: { recordId, result: p.result, operatorId: p.operatorId, timestamp: p.timestamp, kit: p.kit, imageSha256: p.imageSha256 }, usedUploadedImage: !!uploaded };
}
app.get('/api/verify/:id', wrap(async (req, res) => { const v = await verify(req.params.id); v ? res.json(v) : res.status(404).json({ error: 'Record not found' }); }));
app.post('/api/verify/:id', upload.single('image'), wrap(async (req, res) => { const v = await verify(req.params.id, req.file?.buffer); v ? res.json(v) : res.status(404).json({ error: 'Record not found' }); }));

// ---- Tamper demonstration (modifies stored data on purpose; backup allows restore) ----
if (TAMPER_DEMO) {
  app.post('/api/demo/tamper/:id', wrap(async (req, res) => {
    const id = req.params.id, field = req.body.field;
    const r = await Record.findOne({ recordId: id });
    if (!r) return res.status(404).json({ error: 'Record not found' });
    if (await DemoBackup.exists({ recordId: id })) return res.status(409).json({ error: 'Already modified. Restore first.' });
    const im = await Image.findOne({ recordId: id }), bk = { recordId: id, payload: r.payload, image: im?.data };
    const p = structuredClone(r.payload);
    if (field === 'image') { const b = Buffer.from(im.data); b[b.length - 1] ^= 1; await Image.updateOne({ recordId: id }, { data: b }); }
    else if (field === 'result') { p.result = p.result === 'positive' ? 'negative' : 'positive'; await Record.updateOne({ recordId: id }, { payload: p }); }
    else if (field === 'gps') { p.gps = { ...p.gps, lat: (p.gps?.lat ?? 0) + 0.01 }; await Record.updateOne({ recordId: id }, { payload: p }); }
    else if (field === 'timestamp') { p.timestamp = new Date(new Date(p.timestamp).getTime() + 3600e3).toISOString(); await Record.updateOne({ recordId: id }, { payload: p }); }
    else if (field === 'delete-previous') {
      const prev = await Record.findOne({ deviceId: r.deviceId, seq: r.seq - 1 });
      if (!prev) return res.status(400).json({ error: 'No previous record to delete' });
      bk.prevRecord = prev.toObject(); bk.prevImage = (await Image.findOne({ recordId: prev.recordId }))?.data;
      await Record.deleteOne({ _id: prev._id }); await Image.deleteOne({ recordId: prev.recordId });
    } else return res.status(400).json({ error: 'Unknown field' });
    await DemoBackup.create(bk); res.json({ ok: true });
  }));
  app.post('/api/demo/restore/:id', wrap(async (req, res) => {
    const id = req.params.id, bk = await DemoBackup.findOne({ recordId: id });
    if (!bk) return res.json({ ok: true, note: 'Nothing to restore' });
    await Record.updateOne({ recordId: id }, { payload: bk.payload });
    if (bk.image) await Image.updateOne({ recordId: id }, { data: bk.image });
    if (bk.prevRecord) { await Record.create(bk.prevRecord); if (bk.prevImage) await Image.create({ recordId: bk.prevRecord.recordId, contentType: 'image/jpeg', size: bk.prevImage.length, data: bk.prevImage }); }
    await DemoBackup.deleteOne({ recordId: id }); res.json({ ok: true });
  }));
}

const dist = fileURLToPath(new URL('../client/dist', import.meta.url));
if (existsSync(dist)) { app.use(express.static(dist)); app.get('*', (q, r) => r.sendFile(`${dist}/index.html`)); }
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/chromaproof';
try { await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 }); console.log('MongoDB connected:', mongoose.connection.host, '/', mongoose.connection.name); }
catch (e) { console.error(`\nMongoDB connection failed (${e.message}).\nCheck MONGO_URI in server/.env, that mongod is running (local) or your IP is allowed in Atlas Network Access.\n`); process.exit(1); }
app.listen(process.env.PORT || 5001, () => console.log('ChromaProof API on :' + (process.env.PORT || 5001)));
