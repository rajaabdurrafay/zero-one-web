'use strict';
const BUSINESS_TIMEZONE = 'Asia/Karachi';
function money(value) {
  if (!Number.isFinite(value)) throw new Error('Invalid monetary amount');
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
// Preserve the configured whole-rupee activity/discount policy; add-ons retain paisa.
function activityPrice(rate, minutes) {
  if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(rate.basePrice) || rate.basePrice < 0) throw new Error('Invalid pricing input');
  const duration = Math.ceil(minutes);
  let amount;
  if (rate.pricingUnit !== 'PER_MINUTE' && rate.halfHourPrice != null && rate.fullHourPrice != null) {
    amount = Math.floor(duration / 60) * rate.fullHourPrice + (duration % 60) * rate.halfHourPrice / 30;
  } else amount = rate.pricingUnit === 'PER_MINUTE' ? duration * rate.basePrice : duration * rate.basePrice / 60;
  return Math.round(amount);
}
function quote(rate, minutes, offer = null, addons = []) {
  const originalPrice = activityPrice(rate, minutes);
  let discountAmount = 0;
  if (offer && (!offer.minDuration || minutes >= offer.minDuration)) {
    if (!Number.isFinite(offer.discountValue) || offer.discountValue < 0) throw new Error('Invalid discount');
    discountAmount = Math.min(originalPrice, Math.round(offer.discountType === 'PERCENTAGE' ? originalPrice * Math.min(100, offer.discountValue) / 100 : offer.discountValue));
  }
  const addonsTotal = money(addons.reduce((sum, item) => sum + item.priceAtBooking * item.quantity, 0));
  return { originalPrice, discountAmount, addonsTotal, payablePrice: money(originalPrice - discountAmount + addonsTotal) };
}
function elapsedSeconds(session, now = Date.now()) {
  const started = new Date(session.startedAt).getTime();
  const finish = session.endedAt ? new Date(session.endedAt).getTime() : now;
  const paused = session.status === 'PAUSED' && session.pausedAt ? Math.max(0, Math.floor((finish - new Date(session.pausedAt).getTime()) / 1000)) : 0;
  return Math.max(0, Math.floor((finish - started) / 1000) - (session.totalPausedSeconds || 0) - paused);
}
function businessDate(value = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(value)); }
function businessInstant(date, time = '00:00') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Invalid business date/time');
  const result = new Date(`${date}T${time}:00+05:00`);
  if (!Number.isFinite(result.getTime()) || businessDate(result) !== date) throw new Error('Invalid business date/time');
  return result;
}
function canonicalPhone(value) {
  let phone = String(value).replace(/[\s()-]/g, '');
  if (phone.startsWith('0092')) phone = '+' + phone.slice(2);
  if (/^03\d{9}$/.test(phone)) phone = '+92' + phone.slice(1);
  if (/^923\d{9}$/.test(phone)) phone = '+' + phone;
  if (!/^\+923\d{9}$/.test(phone)) throw new Error('Valid Pakistani mobile number is required');
  return phone;
}
function allocatePayments(total,weights) {
  const sum=weights.reduce((a,b)=>a+b,0),cents=Math.round(money(total)*100);
  let assigned=0;
  return weights.map((weight,index)=>{const value=index===weights.length-1 ? cents-assigned : Math.floor(sum ? cents*weight/sum : cents/weights.length);assigned+=value;return value/100});
}
function isSameOriginRequest(request, publicOrigin) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return origin === new URL(publicOrigin || request.url).origin; }
  catch { return false; }
}
module.exports = { isSameOriginRequest, allocatePayments, BUSINESS_TIMEZONE, money, activityPrice, quote, elapsedSeconds, businessDate, businessInstant, canonicalPhone };
