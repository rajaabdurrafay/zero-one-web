import { formatDateReadable, formatTimeRange12h } from './timeUtils';
import { Booking, BookingGroup } from './api';

/**
 * Format local Pakistani phone numbers into international format without leading + or 0
 * e.g., "03371264205" -> "923371264205"
 * e.g., "+92 337-1264205" -> "923371264205"
 * e.g., "0300 1234567" -> "923001234567"
 */
export function formatWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove all non-digit characters
  let cleaned = rawPhone.replace(/\D/g, '');

  // If starts with 0092, strip leading 00
  if (cleaned.startsWith('0092')) {
    cleaned = cleaned.substring(2);
  }
  // If starts with 0 (e.g. 03001234567), replace leading 0 with 92
  else if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  }
  // If does not start with 92 and length is 10 (e.g. 3001234567), prepend 92
  else if (!cleaned.startsWith('92') && cleaned.length === 10) {
    cleaned = '92' + cleaned;
  }

  return cleaned;
}

/**
 * Generate standard WhatsApp Click-to-Chat URL for single booking
 */
export function generateWhatsAppBookingUrl(booking: Booking): string {
  const phone = formatWhatsAppPhone(booking.customer.phone);
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  const bookingId = booking.id.slice(-8).toUpperCase();
  const dateStr = formatDateReadable(startTime);
  const timeStr = formatTimeRange12h(startTime, endTime);
  const priceStr = booking.totalPrice.toLocaleString();
  const activityName = booking.resource?.name || 'ZeroOne Gaming Arena';

  let addonsText = '';
  if (booking.addons && booking.addons.length > 0) {
    const lines = booking.addons.map((ba) => `   - ${ba.addonItem?.name || 'Addon'} x${ba.quantity} (Rs ${(ba.priceAtBooking * ba.quantity).toLocaleString()})`).join('\n');
    addonsText = `\nCafé Add-ons:\n${lines}\n`;
  }

  const message = `ZeroOne Cue & Play - Booking Confirmed

Booking ID: #${bookingId}
Activity: ${activityName}
Date: ${dateStr}
Time: ${timeStr}${addonsText}
Total Amount: Rs ${priceStr}

Venue: F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi
WhatsApp: 0371-2160471 | Open 24/7

Please arrive 5 minutes early. See you soon!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate WhatsApp Click-to-Chat URL for Group Booking with multiple activities
 */
export function generateWhatsAppGroupBookingUrl(group: BookingGroup | (Booking['bookingGroup'] & { customer?: { name: string; phone: string; email?: string | null }; bookings?: Booking[] })): string {
  if (!group) return '';
  const customerPhone = group.customer?.phone || (group.bookings && group.bookings[0]?.customer?.phone) || '';
  const phone = formatWhatsAppPhone(customerPhone);
  const groupId = group.id.slice(-8).toUpperCase();
  const totalAmountStr = (group.totalAmount || 0).toLocaleString();

  const activitiesList = (group.bookings || []).map((b, idx) => {
    const s = new Date(b.startTime);
    const e = new Date(b.endTime);
    const dStr = formatDateReadable(s);
    const tStr = formatTimeRange12h(s, e);
    const aName = b.resource?.name || 'Activity';
    return `${idx + 1}. ${aName}\n   📅 ${dStr} | ⏰ ${tStr}\n   💰 Rs ${b.totalPrice.toLocaleString()}`;
  }).join('\n\n');

  const message = `ZeroOne Cue & Play - Group Booking Confirmed

Group Booking ID: #${groupId}
Total Activities: ${group.bookings?.length || 0}

${activitiesList}

Total Combined Amount: Rs ${totalAmountStr}

Venue: F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi
WhatsApp: 0371-2160471 | Open 24/7

Please arrive 5-10 minutes prior to your first slot. See you soon!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate WhatsApp Click-to-Chat URL for 30-60 Min Reminder Alert
 */
export function generateWhatsAppReminderUrl(booking: Booking): string {
  const phone = formatWhatsAppPhone(booking.customer.phone);
  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  const timeStr = formatTimeRange12h(startTime, endTime);
  const activityName = booking.resource?.name || 'Session';
  const customerName = booking.customer?.name || 'there';

  const message = `Hi ${customerName}, reminder — your ${activityName} session starts at ${timeStr} today at ZeroOne. See you soon!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate WhatsApp Click-to-Chat URL for Inactive / Churn-Risk Customer Win-Back
 */
export function generateWhatsAppWinBackUrl(name: string, rawPhone: string): string {
  const phone = formatWhatsAppPhone(rawPhone);
  const displayName = name && name !== 'Anonymous Guest' ? name : 'there';

  const message = `Hi ${displayName}, we miss you at ZeroOne! It's been a while — come back and enjoy our premium setups on your next visit. Book your slot anytime or message us directly here!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}


