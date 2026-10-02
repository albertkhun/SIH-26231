import crypto from 'node:crypto';
import { canonicalize } from '../shared/canonical.js';
export const GENESIS = '0'.repeat(64);
export const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
export const recordHashOf = (payload, signature) => sha256(canonicalize(payload) + '.' + signature);
export function newKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = publicKey.export({ type: 'spki', format: 'pem' });
  return { publicKeyPem: pub, privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }), keyId: sha256(pub).slice(0, 16) };
}
export const signPayload = (privPem, payload) => crypto.sign(null, Buffer.from(canonicalize(payload)), privPem).toString('base64');
export const verifyPayload = (pubPem, payload, sig) => { try { return crypto.verify(null, Buffer.from(canonicalize(payload)), pubPem, Buffer.from(sig, 'base64')); } catch { return false; } };
