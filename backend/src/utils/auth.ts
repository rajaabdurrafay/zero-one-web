import crypto from 'crypto';
import { promisify } from 'util';
import 'dotenv/config';
const pbkdf2 = promisify(crypto.pbkdf2);
const scryptAsync = (password: string, salt: string, length: number): Promise<Buffer> => new Promise((resolve, reject) => {
  crypto.scrypt(password, salt, length, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
let developmentSecret: string | undefined;
export function validateAuthConfiguration(): void { getSecret(); }
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32 && !secret.includes('change-me') && secret !== 'zero-one-cue-and-play-secret-key-2026') return secret;
  if (process.env.NODE_ENV === 'production') throw new Error('Set a unique JWT_SECRET of at least 32 characters before starting production.');
  if (!developmentSecret) {
    developmentSecret = crypto.randomBytes(48).toString('hex');
    console.warn('JWT_SECRET is missing/weak: using an ephemeral development key. Sessions expire on restart.');
  }
  return developmentSecret;
}
export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'RECEPTIONIST';
export interface AdminTokenPayload { id: string; username: string; name: string; role: AdminRole; credentialTag: string; sessionId: string }
export interface CustomerTokenPayload { customerId: string; phone: string; name: string; credentialTag: string }
export function credentialTag(passwordHash: string): string { return crypto.createHash('sha256').update(passwordHash).digest('hex'); }
// Async scrypt for new passwords, with backward-compatible legacy PBKDF2 verification.
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64) as Buffer;
  return ['scrypt', salt, hash.toString('hex')].join(':');
}
export async function comparePassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split(':');
    const modern = parts.length === 3 && parts[0] === 'scrypt';
    if (!modern && parts.length !== 2) return false;
    const salt = parts[modern ? 1 : 0]; const hash = parts[modern ? 2 : 1];
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hash)) return false;
    const computed = modern ? await scryptAsync(password, salt, 64) as Buffer : await pbkdf2(password, salt, 10000, 64, 'sha512');
    return crypto.timingSafeEqual(computed, Buffer.from(hash, 'hex'));
  } catch { return false; }
}
function sign(payload: object, expiresInSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + expiresInSeconds, iat: now })).toString('base64url');
  const unsigned = header + '.' + body;
  return unsigned + '.' + crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
}
function verify(token: string): Record<string, any> | null {
  try {
    if (typeof token !== 'string' || token.length > 8192) return null;
    const parts = token.split('.'); if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') return null;
    const expected = crypto.createHmac('sha256', getSecret()).update(header + '.' + body).digest('base64url');
    const actualBytes = Buffer.from(signature); const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    const now = Math.floor(Date.now() / 1000);
    if (!payload || !Number.isFinite(payload.exp) || payload.exp <= now || !Number.isFinite(payload.iat) || payload.iat > now + 60) return null;
    return payload;
  } catch { return null; }
}
export function signToken(payload: CustomerTokenPayload, expiresInSeconds = 7 * 86400): string { return sign({ ...payload, kind: 'customer' }, expiresInSeconds); }
export function verifyToken(token: string): CustomerTokenPayload | null {
  const p = verify(token);
  return p?.kind === 'customer' && typeof p.customerId === 'string' && typeof p.credentialTag === 'string' ? p as CustomerTokenPayload : null;
}
export function signAdminToken(payload: AdminTokenPayload, expiresInSeconds = 8 * 3600): string { return sign({ ...payload, kind: 'admin', isAdminToken: true }, expiresInSeconds); }
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  const p = verify(token);
  return p?.kind === 'admin' && p.isAdminToken === true && typeof p.id === 'string' && typeof p.sessionId === 'string' && typeof p.credentialTag === 'string' && ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'].includes(p.role) ? p as AdminTokenPayload : null;
}
export function signBookingAccess(id: string, group = false): string { return sign({ kind: 'booking', id, group }, 86400); }
export function verifyBookingAccess(token: string, id: string, group = false): boolean {
  const p = verify(token); return p?.kind === 'booking' && p.id === id && p.group === group;
}
export function signPaymentImage(url: string): string {
  const pathname = url.split('?')[0];
  return pathname + '?access=' + sign({ kind: 'payment-image', path: pathname }, 15 * 60);
}
export function verifyPaymentImage(token: string, pathname: string): boolean {
  const payload = verify(token); return payload?.kind === 'payment-image' && payload.path === pathname;
}
