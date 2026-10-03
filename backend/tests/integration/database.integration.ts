import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {database as db} from '../../src/db';
import {signAdminToken,credentialTag,hashPassword} from '../../src/utils/auth';
import {businessDate,quote} from '@zeroone/domain';
import type {Server} from 'node:http';
const configured=new URL(process.env.DATABASE_URL!);
if(process.env.NODE_ENV!=='test' || !['127.0.0.1','localhost','[::1]'].includes(configured.hostname) || !configured.pathname.startsWith('/zeroone_test_'))throw Error('Integration tests require an isolated local test DB.');
let server:Server,base:string,adminToken:string,adminId:string;
const suffix=Date.now().toString();
before(async()=>{
  await db.systemSettings.upsert({where:{id:'system_settings'},create:{},update:{maintenanceMode:false,bookingsEnabled:true,walkInsEnabled:true,emergencyClosedToday:false}});
  await db.activity.upsert({where:{resourceType:'PS5_OPEN'},create:{name:'Test PS5',resourceType:'PS5_OPEN',pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900},update:{pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900}});
  await db.activity.upsert({where:{resourceType:'SNOOKER'},create:{name:'Test snooker',resourceType:'SNOOKER',pricingUnit:'PER_MINUTE',basePrice:10},update:{pricingUnit:'PER_MINUTE',basePrice:10,halfHourPrice:null,fullHourPrice:null}});
  const admin=await db.adminUser.create({data:{username:'test-'+suffix,name:'Test admin',password:await hashPassword('TestPassword123!'),role:'SUPER_ADMIN'}});
  adminId=admin.id;
  const login=await db.loginSession.create({data:{adminUserId:admin.id,deviceFingerprint:'test-'+suffix,ipAddress:'127.0.0.1',userAgent:'integration'}});
  adminToken=signAdminToken({id:admin.id,name:admin.name,username:admin.username,role:admin.role,credentialTag:credentialTag(admin.password),sessionId:login.id});
  const {app}=await import('../../src/index');server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+(server.address() as any).port;
});
after(async()=>{server?.closeAllConnections();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();});
async function request(route:string,body?:unknown,staff=false,method=body===undefined?'GET':'POST'){
  const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(staff?{Authorization:'Bearer '+adminToken}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  return {status:res.status,body:await res.json()};
}
async function resource(type:'PS5_OPEN'|'SNOOKER'='PS5_OPEN'){return db.resource.create({data:{name:'test-'+suffix+'-'+Math.random(),type}});}
const customer={name:'Test Guest',phone:'03007777777'};
const interval=(offset=60,duration=30)=>({startTime:new Date(Date.now()+offset*60000).toISOString(),endTime:new Date(Date.now()+(offset+duration)*60000).toISOString()});
test('anonymous group cannot link an existing registered account by phone',async()=>{
  const account=await db.customer.create({data:{name:'Private Name',phone:'03001111111',isRegistered:true,password:'not-used'}});
  const r=await resource();const result=await request('/api/bookings/group',{customer:{name:'Stranger',phone:account.phone},items:[{resourceId:r.id,...interval()}]});
  assert.equal(result.status,201,JSON.stringify(result.body));assert.notEqual(result.body.customer.id,account.id);assert.equal(result.body.customer.name,'Stranger');
});
test('simultaneous overlapping bookings serialize; adjacent slots remain available',async()=>{
  const r=await resource(),slot=interval();const results=await Promise.all([1,2].map(()=>request('/api/bookings',{customer,resourceId:r.id,...slot})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const adjacent=await request('/api/bookings',{customer,resourceId:r.id,startTime:slot.endTime,endTime:new Date(new Date(slot.endTime).getTime()+1800000).toISOString()});assert.equal(adjacent.status,201,JSON.stringify(adjacent.body));
});
test('extension into another booking fails without changing price or end time',async()=>{
  const r=await resource();const c=await db.customer.create({data:customer});const now=Date.now();
  const booking=await db.booking.create({data:{customerId:c.id,resourceId:r.id,status:'CONFIRMED',startTime:new Date(now),endTime:new Date(now+1800000),totalPrice:500,pricingSnapshot:{rate:{pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900},offer:null}}});
  await db.booking.create({data:{customerId:c.id,resourceId:r.id,status:'CONFIRMED',startTime:new Date(now+1900000),endTime:new Date(now+3700000),totalPrice:500}});
  const session=await request('/api/admin/sessions',{resourceId:r.id,bookingId:booking.id,mode:'COUNTDOWN'},true);assert.equal(session.status,201,JSON.stringify(session.body));
  const extension=await request('/api/admin/sessions/'+session.body.id+'/action',{action:'EXTEND',minutes:30},true,'PATCH');assert.equal(extension.status,409);
  assert.equal((await db.booking.findUniqueOrThrow({where:{id:booking.id}})).totalPrice,500);
});
test('active walk-in occupies public availability and stop is atomic/idempotent',async()=>{
  const r=await resource('SNOOKER');const session=await request('/api/admin/sessions',{resourceId:r.id,mode:'COUNT_UP'},true);assert.equal(session.status,201,JSON.stringify(session.body));
  const availability=await request('/api/availability?date='+businessDate());assert.ok(availability.body.resources.find((item:any)=>item.id===r.id).busySlots.length);
  assert.equal((await request('/api/bookings',{customer,resourceId:r.id,...interval()})).status,409);
  await db.session.update({where:{id:session.body.id},data:{startedAt:new Date(Date.now()-120000)}});
  const stopped=await Promise.all([1,2].map(()=>request('/api/admin/sessions/'+session.body.id+'/stop',{},true)));
  assert.deepEqual(stopped.map(r=>r.status),[200,200]);assert.equal(stopped[0].body.finalAmount,20);assert.equal(stopped[1].body.finalAmount,20);
  assert.equal(await db.booking.count({where:{resourceId:r.id}}),1);
  assert.ok((await db.session.findUniqueOrThrow({where:{id:session.body.id}})).bookingId);
});
test('reschedule preserves rate snapshot, discount and add-ons and reconciles group totals',async()=>{
  const r=await resource(),c=await db.customer.create({data:customer}),addon=await db.addonItem.create({data:{name:'Test snack',price:100}});
  const group=await db.bookingGroup.create({data:{customerId:c.id,totalAmount:550,status:'CONFIRMED'}});
  const snapshot={rate:{pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900},offer:{discountType:'PERCENTAGE',discountValue:10}};
  const slot=interval();const booking=await db.booking.create({data:{resourceId:r.id,customerId:c.id,bookingGroupId:group.id,status:'CONFIRMED',startTime:slot.startTime,endTime:slot.endTime,totalPrice:550,discountAmount:50,pricingSnapshot:snapshot,addons:{create:{addonItemId:addon.id,quantity:1,priceAtBooking:100}}}});
  const result=await request('/api/bookings/'+booking.id,{endTime:new Date(new Date(slot.startTime).getTime()+3600000).toISOString()},true,'PATCH');assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.totalPrice,910);assert.equal(result.body.discountAmount,90);
  assert.equal((await db.bookingGroup.findUniqueOrThrow({where:{id:group.id}})).totalAmount,910);
});
test('count-up bills snapshot rate after pause, preserves discounts and add-ons',async()=>{
  const r=await resource('SNOOKER'),c=await db.customer.create({data:customer}),addon=await db.addonItem.create({data:{name:'Bill snack',price:100}});
  const snapshot={rate:{pricingUnit:'PER_MINUTE',basePrice:10},offer:{discountType:'PERCENTAGE',discountValue:10}};
  const now=Date.now();const booking=await db.booking.create({data:{resourceId:r.id,customerId:c.id,status:'CONFIRMED',startTime:new Date(now-600000),endTime:new Date(now+1800000),totalPrice:370,pricingSnapshot:snapshot,addons:{create:{addonItemId:addon.id,priceAtBooking:100,quantity:1}}}});
  const session=await request('/api/admin/sessions',{resourceId:r.id,bookingId:booking.id,mode:'COUNT_UP'},true);assert.equal(session.status,201,JSON.stringify(session.body));
  await db.session.update({where:{id:session.body.id},data:{startedAt:new Date(now-600000),totalPausedSeconds:60,status:'PAUSED',pausedAt:new Date(now-120000)}});
  const stop=await request('/api/admin/sessions/'+session.body.id+'/stop',{},true);assert.equal(stop.status,200,JSON.stringify(stop.body));assert.equal(stop.body.finalAmount,163);
  const final=await db.booking.findUniqueOrThrow({where:{id:booking.id}});assert.equal(final.discountAmount,7);assert.equal(final.totalPrice,163);
});
test('registration races create one canonical identity; guests stay separate; logout revokes token',async()=>{
  const phone='03'+String(Date.now()).slice(-9);
  const guest=await db.customer.create({data:{name:'Historical guest',phone}});
  const payload={name:'Registered Person',phone,password:'TestPassword123!'};
  const results=await Promise.all([1,2].map(()=>request('/api/auth/signup',payload)));
  assert.deepEqual(results.map(result=>result.status).sort(),[201,409]);
  const account=results.find(result=>result.status===201)!.body;
  assert.notEqual(account.customer.id,guest.id);
  const signed=await request('/api/auth/login',{phone:'+92'+phone.slice(1),password:payload.password});assert.equal(signed.status,200);
  const headers={Authorization:'Bearer '+signed.body.token};
  assert.equal((await fetch(base+'/api/auth/me',{headers})).status,200);
  const mine=await fetch(base+'/api/bookings/my-bookings',{headers});assert.equal(mine.status,200);
  assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/api/auth/me',{headers})).status,401);
});
test('reset tokens reject expiry and replay and never promote guest accounts',async()=>{
  const crypto=await import('node:crypto');const token=crypto.randomBytes(32).toString('hex');
  const customer=await db.customer.create({data:{name:'Reset account',phone:'03'+String(Date.now()+11).slice(-9),isRegistered:true,password:await hashPassword('OldPassword123!'),resetToken:crypto.createHash('sha256').update(token).digest('hex'),resetTokenExpiry:new Date(Date.now()+60000)}});
  assert.equal((await request('/api/auth/reset-password',{token,newPassword:'NewPassword123!'})).status,200);
  assert.equal((await request('/api/auth/reset-password',{token,newPassword:'AgainPassword123!'})).status,400);
  const expired='expired-'+token;await db.customer.update({where:{id:customer.id},data:{resetToken:crypto.createHash('sha256').update(expired).digest('hex'),resetTokenExpiry:new Date(Date.now()-1000)}});
  assert.equal((await request('/api/auth/reset-password',{token:expired,newPassword:'NewPassword123!'})).status,400);
  const guestToken='guest-'+token;const guest=await db.customer.create({data:{name:'Guest only',phone:'03008888888',resetToken:crypto.createHash('sha256').update(guestToken).digest('hex'),resetTokenExpiry:new Date(Date.now()+60000)}});
  assert.equal((await request('/api/auth/reset-password',{token:guestToken,newPassword:'NewPassword123!'})).status,400);
  assert.equal((await db.customer.findUniqueOrThrow({where:{id:guest.id}})).isRegistered,false);
});
test('v1 booking pagination counts filters and rejects malformed dates and fractional limits',async()=>{
  const page=await request('/api/v1/bookings?page=1&limit=2',undefined,true);
  assert.equal(page.status,200,JSON.stringify(page.body));assert.equal(page.body.data.length,2);assert.ok(page.body.meta.pagination.total>=2);
  assert.equal((await request('/api/v1/bookings?limit=2.5',undefined,true)).status,400);
  assert.equal((await request('/api/v1/bookings?date=2026-02-30',undefined,true)).status,400);
  assert.equal((await request('/api/offers/validate-code',{promoCode:12})).status,400);
  const invalid=await request('/api/offers',{title:'Invalid offer',description:null,discountType:'PERCENTAGE',discountValue:101,validFrom:new Date().toISOString(),validUntil:new Date(Date.now()+60000).toISOString()},true);assert.equal(invalid.status,400);
});
test('device attendance closes only the logged-out device and records Karachi midnight',async()=>{
  const login=async(userAgent:string)=>{
    const response=await fetch(base+'/api/auth/admin/login',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':userAgent},body:JSON.stringify({username:'test-'+suffix,password:'TestPassword123!'})});assert.equal(response.status,200);return response.json();
  };
  const first=await login('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0');
  await login('Mozilla/5.0 (Android 14) Chrome/120.0');
  assert.equal(await db.attendanceLog.count({where:{adminUserId:adminId,logoutAt:null}}),2);
  const logout=await fetch(base+'/api/auth/admin/logout',{method:'POST',headers:{Authorization:'Bearer '+first.token}});assert.equal(logout.status,200);
  assert.equal(await db.attendanceLog.count({where:{adminUserId:adminId,logoutAt:null}}),1);
  const log=await db.attendanceLog.findFirstOrThrow({where:{adminUserId:adminId}});assert.equal(log.date.toISOString().slice(11),'19:00:00.000Z');
});
test('group add-ons and recorded payments reconcile once; closed sessions remain in history',async()=>{
  const r=await resource(),other=await resource();const addon=await db.addonItem.create({data:{name:'Group snack',price:100}});
  const group=await request('/api/bookings/group',{customer,isWalkIn:true,items:[{resourceId:r.id,...interval()},{resourceId:other.id,...interval()}],addons:[{addonItemId:addon.id,quantity:1}],amountPaid:1100},true);
  assert.equal(group.status,201,JSON.stringify(group.body));assert.equal(group.body.totalAmount,1100);assert.equal(group.body.bookings.reduce((sum:number,b:any)=>sum+b.totalPrice,0),1100);assert.equal(group.body.bookings.reduce((sum:number,b:any)=>sum+b.amountPaid,0),1100);
  const history=await request('/api/admin/sessions/history?limit=2',undefined,true);assert.equal(history.status,200);assert.equal(history.body.length,2);assert.ok(history.body.every((s:any)=>s.status==='COMPLETED' && s.bookingId));
});

test('guest history requires a verified staff claim and matching registered identity',async()=>{
  const phone='03'+String(Date.now()+77).slice(-9);
  const guest=await db.customer.create({data:{name:'Claim guest',phone}});
  const account=await db.customer.create({data:{name:'Claim account',phone,isRegistered:true,password:'not-used'}});
  const r=await resource();const booking=await db.booking.create({data:{customerId:guest.id,resourceId:r.id,...interval(),totalPrice:500}});
  const route='/api/admin/customers/'+guest.id+'/claim-bookings';
  assert.equal((await request(route,{accountId:account.id,verificationNote:'Owner verified in person'})).status,401);
  assert.equal((await request(route,{accountId:account.id,verificationNote:'short'},true)).status,400);
  const other=await db.customer.create({data:{name:'Other account',phone:'03009999999',isRegistered:true,password:'not-used'}});
  assert.equal((await request(route,{accountId:other.id,verificationNote:'Owner verified in person'},true)).status,409);
  const claimed=await request(route,{accountId:account.id,verificationNote:'Owner verified in person'},true);
  assert.equal(claimed.status,200,JSON.stringify(claimed.body));assert.equal(claimed.body.claimedBookings,1);
  assert.equal((await db.booking.findUniqueOrThrow({where:{id:booking.id}})).customerId,account.id);
  assert.ok(await db.customer.findUnique({where:{id:guest.id}}));
  assert.equal(await db.auditLog.count({where:{entity:'CUSTOMER_BOOKING_CLAIM',entityId:guest.id}}),1);
});

test('content validation rejects executable links and unsafe theme CSS; archive preserves add-on history',async()=>{
  assert.equal((await request('/api/popup-settings/admin',{buttonLink:'javascript:alert(1)'},true,'PUT')).status,400);
  assert.equal((await request('/api/theme',{target:'WEBSITE',primaryColor:'red;display:none'},true,'PUT')).status,400);
  const addon=await db.addonItem.create({data:{name:'Archive snack',price:100}});
  const result=await request('/api/addons/'+addon.id,undefined,true,'DELETE');assert.equal(result.status,200,JSON.stringify(result.body));
  assert.equal((await db.addonItem.findUniqueOrThrow({where:{id:addon.id}})).isAvailable,false);
});

test('successful extension recalculates tier pricing and retains a valid reservation interval',async()=>{
  const r=await resource(),c=await db.customer.create({data:customer}),now=Date.now();
  const booking=await db.booking.create({data:{resourceId:r.id,customerId:c.id,status:'CONFIRMED',startTime:new Date(now-1000),endTime:new Date(now+1799000),totalPrice:500,pricingSnapshot:{rate:{pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900},offer:null}}});
  const started=await request('/api/admin/sessions',{resourceId:r.id,bookingId:booking.id,mode:'COUNTDOWN'},true);assert.equal(started.status,201,JSON.stringify(started.body));
  const extended=await request('/api/admin/sessions/'+started.body.id+'/action',{action:'EXTEND',minutes:30},true,'PATCH');assert.equal(extended.status,200,JSON.stringify(extended.body));
  const final=await db.booking.findUniqueOrThrow({where:{id:booking.id}});assert.equal(final.totalPrice,900);assert.ok(final.endTime>final.startTime);
});

test('concurrent resume and stop cannot reopen a completed session',async()=>{
  const r=await resource('SNOOKER');const started=await request('/api/admin/sessions',{resourceId:r.id,mode:'COUNT_UP'},true);assert.equal(started.status,201);
  await db.session.update({where:{id:started.body.id},data:{status:'PAUSED',pausedAt:new Date(),startedAt:new Date(Date.now()-120000)}});
  const results=await Promise.all([
    request('/api/admin/sessions/'+started.body.id+'/action',{action:'RESUME'},true,'PATCH'),
    request('/api/admin/sessions/'+started.body.id+'/stop',{},true)
  ]);
  assert.ok([200,400].includes(results[0].status));assert.equal(results[1].status,200,JSON.stringify(results[1].body));
  assert.equal((await db.session.findUniqueOrThrow({where:{id:started.body.id}})).status,'COMPLETED');
  assert.equal(await db.booking.count({where:{resourceId:r.id}}),1);
});
