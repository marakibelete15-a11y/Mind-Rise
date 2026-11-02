import crypto from 'node:crypto';
import { config } from '../config/index.js';
const key = () => { if (!/^[0-9a-fA-F]{64}$/.test(config.encryptionKey)) throw new Error('ENCRYPTION_KEY must be configured as 32-byte hex.'); return Buffer.from(config.encryptionKey, 'hex'); };
export function encrypt(value: string): string { const iv=crypto.randomBytes(12); const c=crypto.createCipheriv('aes-256-gcm',key(),iv); const ciphertext=Buffer.concat([c.update(value,'utf8'),c.final()]); return `enc_v1:${Buffer.concat([iv,c.getAuthTag(),ciphertext]).toString('base64')}`; }
export function decrypt(value: string): string { if (!value.startsWith('enc_v1:')) throw new Error('Unsupported encrypted value.'); const b=Buffer.from(value.slice(7),'base64'); if(b.length<28) throw new Error('Invalid encrypted value.'); const d=crypto.createDecipheriv('aes-256-gcm',key(),b.subarray(0,12)); d.setAuthTag(b.subarray(12,28)); return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8'); }
export function hmacHash(value: string): string { if(!config.hashPepper) throw new Error('HASH_PEPPER must be configured.'); return crypto.createHmac('sha256',config.hashPepper).update(value).digest('hex'); }
export const encryptJson = (value: unknown) => encrypt(JSON.stringify(value));
export function decryptJson<T=unknown>(value: string): T { return JSON.parse(decrypt(value)) as T; }
