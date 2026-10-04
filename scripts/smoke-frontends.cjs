// Exercise production Next.js handlers against a disposable HTTP fixture.
// No real database, email provider or configured backend is contacted.
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const nextBin = require.resolve('next/dist/bin/next');
const revalidationSecret = 'fixture-revalidation-' + 'x'.repeat(48);
const children = [];
let failures = '';
let backend;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).status < 500) return; } catch {}
    await pause(200);
  }
  throw new Error('Frontend failed to start. ' + failures);
}
function start(app, port, api) {
  const child = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: path.join(root, app), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production', API_URL: api, NEXT_PUBLIC_API_URL: api, REVALIDATE_SECRET: revalidationSecret },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', data => { failures = (failures + data.toString()).slice(-4000); });
  child.stdout.on('data', () => {});
  children.push(child);
  return child;
}
function cookie(response, name) {
  const cookies = response.headers.getSetCookie();
  const found = cookies.find(value => value.startsWith(name + '='));
  assert.ok(found, 'Expected session cookie');
  assert.match(found, /HttpOnly/i); assert.match(found, /Secure/i); assert.match(found, /SameSite=lax/i);
  return found.split(';')[0];
}
async function main() {
  let lastAuthorization, logoutRevoked = false, rejectLogout = false;
  let homeOffers = [];
  backend = http.createServer((request, response) => {
    lastAuthorization = request.headers.authorization;
    response.setHeader('Content-Type', 'application/json');
    const send = data => response.end(JSON.stringify(data));
    if (request.url === '/api/offers/active') return send(homeOffers);
    if (request.url.startsWith('/api/reviews')) return send({reviews:[],stats:{totalReviews:0,averageRating:5}});
    if (request.url === '/api/public-stats') return send({totalPlayerVisits:0});
    if (request.url === '/api/auth/admin/login') return send({ token: 'fixture-admin-token', user: {id:'admin1',username:'test',name:'Test',role:'SUPER_ADMIN'}, isNewDevice: false });
    if (request.url === '/api/auth/admin/me') {
      if (lastAuthorization !== 'Bearer fixture-admin-token') { response.statusCode = 401; return send({error:'Unauthorized'}); }
      return send({user:{id:'admin1',role:'SUPER_ADMIN',name:'Test'}});
    }
    if (request.url === '/api/auth/login') return send({token:'fixture-customer-token',customer:{id:'customer1',name:'Test',phone:'03000000000',isRegistered:true}});
    if (request.url === '/api/auth/me') return send({id:'customer1',name:'Test'});
    if (request.url.startsWith('/api/theme')) return send({primaryColor:'#123456',primaryDarkColor:'#123456',accentColor:'#334455',accentDarkColor:'#334455',backgroundColor:'#090d16',textColor:'#f8fafc',displayFont:'Inter',bodyFont:'Inter'});
    if (request.url === '/api/auth/logout') { if(rejectLogout){response.statusCode=503;return send({error:'Temporarily unavailable'})} logoutRevoked = lastAuthorization === 'Bearer fixture-customer-token'; return send({success:true}); }
    return send({success:true,authorized:Boolean(lastAuthorization)});
  });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const api = 'http://127.0.0.1:' + backend.address().port;
  const admin = 'http://localhost:4310', website = 'http://localhost:4312';
  start('admin', 4310, api); start('website', 4312, api);
  await Promise.all([ready(admin + '/login'), ready(website + '/api/revalidate')]);
  assert.match(await (await fetch(admin+'/login')).text(), /#123456/, 'Server-rendered admin theme uses configured backend');

  const adminLogin = await fetch(admin + '/api/auth/login', {method:'POST',headers:{Origin:admin,'Content-Type':'application/json'},body:JSON.stringify({username:'test',password:'test-password'})});
  assert.equal(adminLogin.status,200);
  const adminCookie = cookie(adminLogin,'gz-admin-session');
  assert.equal((await adminLogin.json()).token,undefined);
  assert.ok(!adminLogin.headers.getSetCookie().some(value => value.startsWith('gz-admin-token=fixture')));
  const adminRelay = await fetch(admin+'/api/backend/api/bookings',{headers:{Cookie:adminCookie}});
  assert.equal(adminRelay.status,200); assert.equal(lastAuthorization,'Bearer fixture-admin-token');
  assert.equal((await fetch(admin+'/api/backend/api/bookings')).status,401);
  assert.equal((await fetch(admin+'/api/backend/api/bookings',{method:'POST',headers:{Cookie:adminCookie,Origin:'https://attacker.invalid'},body:'{}'})).status,403);
  const forged = await fetch(admin+'/staff',{headers:{Cookie:'gz-admin-session=forged; gz-admin-role=SUPER_ADMIN'},redirect:'manual'});
  assert.equal(forged.status,307); assert.match(forged.headers.get('location'),/\/login$/);
  console.log('PASS admin HttpOnly login, API relay, CSRF and forged-session rejection');

  const customerLogin = await fetch(website+'/api/backend/api/auth/login',{method:'POST',headers:{Origin:website,'Content-Type':'application/json'},body:JSON.stringify({phone:'03000000000',password:'test-password'})});
  assert.equal(customerLogin.status,200);
  const customerCookie = cookie(customerLogin,'zeroone-customer-session');
  assert.equal((await customerLogin.json()).token,'cookie-session');
  const profile = await fetch(website+'/api/backend/api/auth/me',{headers:{Cookie:customerCookie}});
  assert.equal(profile.status,200); assert.equal(lastAuthorization,'Bearer fixture-customer-token');
  assert.equal((await fetch(website+'/api/backend/api/bookings',{method:'POST',headers:{Cookie:customerCookie,Origin:'https://attacker.invalid'},body:'{}'})).status,403);
  rejectLogout = true;
  const failedLogout = await fetch(website+'/api/auth/logout',{method:'POST',headers:{Origin:website,Cookie:customerCookie}});
  assert.equal(failedLogout.status,502);assert.equal(failedLogout.headers.getSetCookie().length,0,'Failed revocation retains the cookie for retry');
  rejectLogout = false;
  const logout = await fetch(website+'/api/auth/logout',{method:'POST',headers:{Origin:website,Cookie:customerCookie}});
  assert.equal(logout.status,200); assert.ok(logout.headers.getSetCookie().some(value=>value.startsWith('zeroone-customer-session=;')));
  assert.equal(logoutRevoked,true,'Logout revokes backend credential before clearing cookie');
  console.log('PASS customer HttpOnly login, relay, CSRF and cookie logout');

  assert.equal((await fetch(website+'/api/revalidate',{method:'POST'})).status,401);
  assert.equal((await fetch(website+'/api/revalidate',{method:'POST',headers:{Authorization:'Bearer '+revalidationSecret}})).status,200);
  const securityHeaders = await fetch(website+'/login');
  assert.equal(securityHeaders.headers.get('x-content-type-options'),'nosniff');
  assert.equal(securityHeaders.headers.get('x-frame-options'),'DENY');
  assert.equal(securityHeaders.headers.get('x-powered-by'),null);
  console.log('PASS protected cache revalidation and frontend security headers');

  const sampleOffer = {id:'fixture-offer',title:'Fixture offer',description:'A local test offer',isActive:true,isVisibleOnWebsite:true,discountType:'PERCENTAGE',discountValue:10,applicableTo:'ALL_ACTIVITIES'};
  for (const count of [0, 1, 2]) {
    homeOffers = Array.from({length:count}, (_, index) => ({...sampleOffer,id:`fixture-offer-${index}`,title:`Fixture offer ${index}`}));
    const response = await fetch(website+'/');
    assert.equal(response.status,200);
    const html = await response.text();
    const featureSection = html.match(/<section class="zo-section zo-container" aria-label="Featured ZeroOne experiences">[\s\S]*?<\/section>/)?.[0];
    const nextSessionCard = [...(featureSection || '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].find((card) => card[2].includes('A little play goes a long way.'));
    assert.ok(nextSessionCard,'Next-session feature card renders');
    assert.match(nextSessionCard[1],/href="\/activities"/,'Next-session feature opens activities regardless of current offers');
    const statsSection = html.match(/<section class="zo-stats zo-container"[\s\S]*?<\/section>/)?.[0];
    assert.ok(statsSection,'Home statistics render without client JavaScript');
    assert.match(statsSection,/class="zo-count-visible" aria-hidden="true">06<\/span>/);
    assert.match(statsSection,/class="zo-count-visible" aria-hidden="true">24\/7<\/span>/);
    assert.match(statsSection,/class="sr-only">06<\/span>/,'Assistive technology gets the final value rather than animation frames');
    const section = html.match(/<section class="zo-section zo-latest"[\s\S]*?<\/section>/)?.[0];
    assert.ok(section,'Home offers section renders');
    assert.equal((section.match(/class="zo-news-card(?: zo-news-card-featured)?"/g)||[]).length,count||2);
    assert.equal(section.includes('zo-news-grid-single'),count===1,'Only a single offer fills the grid');
    assert.equal(section.includes('zo-news-card-featured'),count===1);
    assert.equal(section.includes('Explore the Experiences'),count===0);
    assert.equal(section.includes('No active offers right now.'),count===0);
    assert.equal(section.includes('Explore Current Offers'),count>0);
    if(count) assert.match(section,/offerId=fixture-offer-0/,'The deal keeps its booking link');
    else {assert.match(section,/friendly snooker rivalry/);assert.match(section,/movie night with your name/);}
  }
  console.log('PASS home offers: zero-offer fallback, single full-width deal, two cards and booking links');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{
  for (const child of children) child.kill();
  if (backend) {backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));}
});
