import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { transitionBookingStock } from '../src/services/bookingStock';
import { database } from '../src/db';

test('repeated cancellation and rejection do not replenish inventory twice', async () => {
  // These transitions return before any database call; fixtures cannot contact a live DB.
  await transitionBookingStock('booking1', 'CANCELLED', 'CANCELLED');
  await transitionBookingStock('booking1', 'REJECTED', 'CANCELLED');
  await transitionBookingStock('booking1', 'AWAITING_VERIFICATION', 'CONFIRMED');
});

test('stock is atomically restored, and resubmission fails when stock is unavailable', async t => {
  const originalAddons = database.bookingAddon.findMany;
  const originalFind = database.addonItem.findUnique;
  const originalUpdate = database.addonItem.updateMany;
  const originalBooking = database.booking.findUnique;
  database.booking.findUnique = (async () => null) as any;
  database.bookingAddon.findMany = (async () => [{addonItemId:'addon1',quantity:2}]) as any;
  database.addonItem.findUnique = (async () => ({stock:1})) as any;
  const updates: any[]=[];
  database.addonItem.updateMany = (async (args:any) => {updates.push(args);return {count:updates.length===1?1:0}}) as any;
  t.after(() => {database.bookingAddon.findMany=originalAddons;database.addonItem.findUnique=originalFind;database.addonItem.updateMany=originalUpdate;database.booking.findUnique=originalBooking});
  await transitionBookingStock('booking1','PENDING_PAYMENT','CANCELLED');
  assert.deepEqual(updates[0].data,{stock:{increment:2}});
  await assert.rejects(transitionBookingStock('booking1','REJECTED','AWAITING_VERIFICATION'), /no longer available/);
  assert.deepEqual(updates[1].where.stock,{gte:2});
});

test('rejected payment cannot reopen a slot reserved by another booking', async t => {
  const originalFind=database.booking.findUnique, originalConflict=database.booking.findFirst;
  database.booking.findUnique=(async()=>({resourceId:'resource1',startTime:new Date(),endTime:new Date(Date.now()+3600000)})) as any;
  database.booking.findFirst=(async()=>({id:'other-booking'})) as any;
  t.after(()=>{database.booking.findUnique=originalFind;database.booking.findFirst=originalConflict});
  await assert.rejects(transitionBookingStock('booking1','REJECTED','AWAITING_VERIFICATION'),/no longer available/);
});

test('Excel export still round-trips with patched UUID dependency', async () => {
  const workbook=new ExcelJS.Workbook();
  const sheet=workbook.addWorksheet('Report');sheet.addRow(['Name','Amount']);sheet.addRow(['Test',123]);
  sheet.addConditionalFormatting({ref:'B2',rules:[{type:'dataBar',cfvo:[{type:'min'},{type:'max'}],color:{argb:'FF00FF00'}}]});
  const output=await workbook.xlsx.writeBuffer();
  const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(output);
  assert.equal(loaded.getWorksheet('Report')?.getCell('B2').value,123);
});
