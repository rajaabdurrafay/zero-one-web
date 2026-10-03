import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activityPrice,quote,elapsedSeconds,businessInstant,businessDate,canonicalPhone,allocatePayments} from '@zeroone/domain';
const rate={pricingUnit:'PER_HOUR',basePrice:900,halfHourPrice:500,fullHourPrice:900};
test('tier pricing recalculates the full duration, including extension boundaries',()=>{
  assert.equal(activityPrice(rate,30),500); assert.equal(activityPrice(rate,60),900); assert.equal(activityPrice(rate,90),1400);
  assert.equal(activityPrice({...rate,pricingUnit:'PER_MINUTE',basePrice:10},31),310);
});
test('group payment allocation preserves exact paisa and adds snacks once',()=>{
  const allocated=allocatePayments(100,[500,550,100]);assert.equal(allocated.reduce((sum,amount)=>Math.round((sum+amount)*100)/100,0),100);
  assert.deepEqual(allocatePayments(1000,[550,450]),[550,450]);
});
test('discounts apply to activity only, cap at zero, and add-on paisa remain accurate',()=>{
  assert.deepEqual(quote(rate,60,{discountType:'PERCENTAGE',discountValue:10},[{priceAtBooking:25.25,quantity:2}]),{originalPrice:900,discountAmount:90,addonsTotal:50.5,payablePrice:860.5});
  assert.equal(quote(rate,30,{discountType:'FIXED_AMOUNT',discountValue:9999}).payablePrice,0);
  assert.equal(quote(rate,30,{discountType:'PERCENTAGE',discountValue:20,minDuration:60}).discountAmount,0);
  assert.throws(()=>activityPrice(rate,-1));
});
test('paused sessions stop accumulating billable seconds; completed sessions use endedAt',()=>{
  const now=Date.UTC(2026,9,3,10);
  assert.equal(elapsedSeconds({startedAt:new Date(now-600000),status:'PAUSED',pausedAt:new Date(now-120000),totalPausedSeconds:60},now),420);
  assert.equal(elapsedSeconds({startedAt:new Date(now-600000),endedAt:new Date(now-120000),status:'COMPLETED',totalPausedSeconds:60},now+999999),420);
});
test('Karachi midnight and canonical Pakistani identities are independent of host timezone',()=>{
  assert.equal(businessInstant('2026-10-03','00:00').toISOString(),'2026-10-02T19:00:00.000Z');
  assert.equal(businessDate('2026-10-02T20:00:00Z'),'2026-10-03');
  assert.throws(()=>businessInstant('2026-02-30'));
  for(const phone of ['03001234567','+923001234567','00923001234567','923001234567'])assert.equal(canonicalPhone(phone),'+923001234567');
});
