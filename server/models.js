import mongoose from 'mongoose';
const { Schema, model } = mongoose;
export const Counter = model('Counter', new Schema({ _id: String, n: { type: Number, default: 0 } }));
export const nextN = async (name) => (await Counter.findByIdAndUpdate(name, { $inc: { n: 1 } }, { new: true, upsert: true })).n;
export const Device = model('Device', new Schema({
  deviceId: { type: String, unique: true }, operatorId: String, keyId: String, publicKeyPem: String,
  privateKeyPem: { type: String, select: false }, tokenHash: { type: String, select: false },
  enrolledAt: Date, revokedAt: Date }));
// Top-level deviceId/seq are chain-ordering fields; the signed content lives in `payload`.
const rec = new Schema({ recordId: { type: String, unique: true }, deviceId: String, seq: Number, keyId: String,
  payload: Schema.Types.Mixed, signature: String, recordHash: String, createdAt: Date }, { minimize: false });
rec.index({ deviceId: 1, seq: 1 }, { unique: true });
['kit', 'sampleId', 'operatorId', 'result', 'timestamp'].forEach((f) => rec.index({ [`payload.${f}`]: 1 }));
export const Record = model('Record', rec);
export const Image = model('Image', new Schema({ recordId: { type: String, unique: true }, contentType: String, size: Number, data: Buffer }));
export const DemoBackup = model('DemoBackup', new Schema({ recordId: { type: String, unique: true }, payload: Schema.Types.Mixed, image: Buffer, prevRecord: Schema.Types.Mixed, prevImage: Buffer }));
