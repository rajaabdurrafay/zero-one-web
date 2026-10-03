const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertLocalDatabase,localEnvironment}=require('./local-environment.cjs');
const net=require('node:net');
const {checkPort}=require('./local.cjs');
test('local launcher detects an occupied IPv6 port',async()=>{
  const server=net.createServer();
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({port:0,host:'::',ipv6Only:true},resolve);});
  try { await assert.rejects(checkPort(server.address().port),/occupied/); }
  finally { await new Promise(resolve=>server.close(resolve)); }
});
test('local launch refuses remote, production-named, invalid and socket-override DB targets',()=>{
  for(const url of [undefined,'broken','mysql://user:secret@db.example.com/zeroone_dev','mysql://user:secret@localhost/production','mysql://user:secret@localhost/zeroone_test_ci','postgres://localhost/zeroone_dev','mysql://localhost/zeroone_dev?socket=/remote/socket']) {
    assert.throws(()=>assertLocalDatabase(url));
  }
  assert.equal(assertLocalDatabase('mysql://user:secret@127.0.0.1:3306/zeroone_dev').hostname,'127.0.0.1');
});
test('local runtime replaces services with loopback URLs, unique keys and no external delivery',()=>{
  const env=localEnvironment({databaseUrl:'mysql://localhost/zeroone_dev',jwtSecret:'local-only-key',revalidateSecret:'local-only-revalidate'});
  assert.equal(env.RESEND_API_KEY,'');
  assert.equal(env.ENABLE_IP_GEOLOCATION,'false');
  assert.equal(env.HOST,'127.0.0.1');
  assert.equal(env.API_URL,'http://localhost:3001');
  assert.equal(env.JWT_SECRET,'local-only-key');
  assert.equal(env.ZEROONE_LOCAL_ONLY,'true');
  assert.equal(env.PAYMENT_BANK_ACCOUNT,'LOCAL TEST ONLY');
});
