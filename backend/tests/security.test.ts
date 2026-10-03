import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { hashPassword, comparePassword, signToken, signAdminToken, verifyToken, verifyAdminToken, signBookingAccess, verifyBookingAccess, credentialTag, signPaymentImage, verifyPaymentImage, validateAuthConfiguration } from '../src/utils/auth';
import { decodeImage, deleteLocalUpload } from '../src/utils/uploads';
import { database } from '../src/db';
import { extractClientIp } from '../src/utils/deviceTracker';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:3002';
let server: Server;
let base: string;
before(async () => {
  const { app } = await import('../src/index');
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = 'http://127.0.0.1:' + (server.address() as any).port;
});
after(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await database.$disconnect(); });

test('scrypt credentials and legacy passwords verify; malformed hashes fail safely', async () => {
  const hash = await hashPassword('StrongPassword123!');
  assert.match(hash, /^scrypt:/);
  assert.equal(await comparePassword('StrongPassword123!', hash), true);
  assert.equal(await comparePassword('wrong', hash), false);
  const salt = crypto.randomBytes(16).toString('hex');
  const legacy = salt + ':' + crypto.pbkdf2Sync('legacy', salt, 10000, 64, 'sha512').toString('hex');
  assert.equal(await comparePassword('legacy', legacy), true);
  assert.equal(await comparePassword('password', 'bad:00'), false);
});

test('token tampering, expiration, wrong purpose and missing expiry are rejected', () => {
  const customer = { customerId: 'customer1', phone: '03000000000', name: 'Test', credentialTag: 'tag' };
  const admin = { id: 'admin1', username: 'test', name: 'Test', role: 'SUPER_ADMIN' as const, credentialTag: 'tag', sessionId: 'session1' };
  const token = signToken(customer);
  assert.deepEqual(verifyToken(token)?.customerId, customer.customerId);
  assert.equal(verifyAdminToken(token), null);
  assert.equal(verifyToken(signAdminToken(admin)), null);
  assert.equal(verifyToken(signToken(customer, -1)), null);
  assert.equal(verifyToken(token.slice(0, -1)), null);
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const body = Buffer.from(JSON.stringify({...customer,kind:'customer',iat:Math.floor(Date.now()/1000)})).toString('base64url');
  const unsigned = header + '.' + body;
  const noExpiry = unsigned + '.' + crypto.createHmac('sha256', process.env.JWT_SECRET!).update(unsigned).digest('base64url');
  assert.equal(verifyToken(noExpiry), null);
});

test('guest access is restricted to its booking and payment links to their file', () => {
  const access = signBookingAccess('booking1');
  assert.equal(verifyBookingAccess(access, 'booking1'), true);
  assert.equal(verifyBookingAccess(access, 'booking2'), false);
  assert.equal(verifyBookingAccess(access, 'booking1', true), false);
  const link = signPaymentImage('/uploads/payment_test.png');
  const token = new URL(link, base).searchParams.get('access')!;
  assert.equal(verifyPaymentImage(token, '/uploads/payment_test.png'), true);
  assert.equal(verifyPaymentImage(token, '/uploads/payment_other.png'), false);
});

test('production startup rejects hardcoded and weak secrets', () => {
  const secret = process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production'; process.env.JWT_SECRET = 'zero-one-cue-and-play-secret-key-2026';
  assert.throws(validateAuthConfiguration, /JWT_SECRET/);
  process.env.JWT_SECRET = secret; process.env.NODE_ENV = 'test';
});

test('image validation rejects SVG, MIME spoofing, raw data and excessive size', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOsAAAAASUVORK5CYII=';
  assert.equal(decodeImage(png).extension, 'png');
  assert.throws(() => decodeImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
  assert.throws(() => decodeImage('data:image/png;base64,PGh0bWw+PC9odG1sPg=='));
  assert.throws(() => decodeImage('arbitrary-file'));
  assert.throws(() => decodeImage(png, 0.00001));
  // Does not follow path traversal into another directory.
  assert.doesNotThrow(() => deleteLocalUpload('/uploads/gallery/../../.env', 'gallery'));
});

test('health, security headers, CORS and private payment images', async () => {
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal((await fetch(base + '/health', {headers:{Origin:'https://attacker.invalid'}})).status, 403);
  const permitted = await fetch(base + '/health', {headers:{Origin:'http://localhost:3002'}});
  assert.equal(permitted.headers.get('access-control-allow-origin'), 'http://localhost:3002');
  assert.equal((await fetch(base + '/uploads/payment_test.png')).status, 401);
  assert.equal((await fetch(base + '/missing')).status, 404);
});

test('sensitive booking and management endpoints reject anonymous requests', async () => {
  for (const route of ['/api/bookings', '/api/bookings/reminders-due', '/api/bookings/reminders-history', '/api/bookings/booking1', '/api/bookings/group/group1', '/api/offers', '/api/addons/top', '/api/admin/backup/full', '/api/admin/staff']) {
    assert.equal((await fetch(base + route)).status, 401, route);
  }
  assert.equal((await fetch(base + '/api/bookings/booking1', {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'CONFIRMED'})})).status, 401);
  assert.equal((await fetch(base + '/api/bookings/booking1/upload-payment', {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status, 401);
});

test('deactivation, password rotation and current role revoke stale privileges', async t => {
  const password = 'stored-password-hash';
  let account: any = {id:'admin1',name:'Test',username:'test',password,isActive:false,role:'SUPER_ADMIN'};
  const originalSession = database.loginSession.findUnique;
  database.loginSession.findUnique = (async () => ({adminUserId:'admin1'})) as any;
  t.after(() => { database.loginSession.findUnique = originalSession; });
  const original = database.adminUser.findUnique;
  database.adminUser.findUnique = (async () => account) as any;
  t.after(() => { database.adminUser.findUnique = original; });
  const token = signAdminToken({id:'admin1',name:'Test',username:'test',role:'SUPER_ADMIN',credentialTag:credentialTag(password),sessionId:'session1'});
  const headers = {Authorization:'Bearer '+token};
  assert.equal((await fetch(base+'/api/auth/admin/me',{headers})).status,401);
  account = {...account,isActive:true,password:'rotated'};
  assert.equal((await fetch(base+'/api/auth/admin/me',{headers})).status,401);
  account = {...account,password,role:'RECEPTIONIST'};
  assert.equal((await fetch(base+'/api/admin/staff',{headers})).status,403);
  account = {...account,role:'SUPER_ADMIN'};
  database.loginSession.findUnique = (async () => null) as any;
  assert.equal((await fetch(base+'/api/auth/admin/me',{headers})).status,401);
});

test('customer cannot access another customer booking', async t => {
  const password = 'customer-password-hash';
  const originalCustomer = database.customer.findUnique;
  database.customer.findUnique = (async () => ({id:'customer1',name:'Test',phone:'03000000000',password,isRegistered:true})) as any;
  t.after(() => { database.customer.findUnique = originalCustomer; });
  const originalBooking = database.booking.findUnique;
  database.booking.findUnique = (async () => ({id:'booking1',customerId:'customer2'})) as any;
  t.after(() => { database.booking.findUnique = originalBooking; });
  const token = signToken({customerId:'customer1',name:'Test',phone:'03000000000',credentialTag:credentialTag(password)});
  assert.equal((await fetch(base+'/api/bookings/booking1',{headers:{Authorization:'Bearer '+token}})).status,404);
});

test('image validation runs before uploads reach handlers', async () => {
  const response = await fetch(base+'/api/auth/profile-picture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoBase64:'data:image/png;base64,PGh0bWw+PC9odG1sPg=='})});
  assert.equal(response.status,400);
});

test('IP tracking ignores forged forwarding headers unless Express trusts the proxy', () => {
  assert.equal(extractClientIp({ip:'127.0.0.1',headers:{'x-forwarded-for':'attacker'},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
});

test('authentication attempts are rate-limited', async () => {
  let status = 0;
  for (let i=0;i<31;i++) status=(await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status;
  assert.equal(status,429);
});
