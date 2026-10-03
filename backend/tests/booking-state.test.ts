import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertBookingTransition} from '../src/services/bookingState';
test('finalized bookings cannot be reopened by payment or admin status changes',()=>{
  for(const from of ['COMPLETED','CANCELLED'])for(const to of ['PENDING_PAYMENT','AWAITING_VERIFICATION','CONFIRMED'])assert.throws(()=>assertBookingTransition(from,to),{status:409});
  assert.doesNotThrow(()=>assertBookingTransition('REJECTED','AWAITING_VERIFICATION'));
  assert.doesNotThrow(()=>assertBookingTransition('CONFIRMED','COMPLETED'));
});
