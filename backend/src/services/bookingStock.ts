import { BookingStatus } from '@prisma/client';
import { prisma } from '../db';

export function reservesStock(status: BookingStatus): boolean {
  return status !== BookingStatus.CANCELLED && status !== BookingStatus.REJECTED;
}
// Call inside the same booking transaction as the status change. Atomic increments
// and conditional decrements protect inventory against retries/concurrent staff edits.
export async function transitionBookingStock(bookingId: string, previous: BookingStatus, next: BookingStatus): Promise<void> {
  if (reservesStock(previous) === reservesStock(next)) return;
  if (reservesStock(next)) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (booking) {
      const conflict = await prisma.booking.findFirst({ where: {
        id: { not: bookingId }, resourceId: booking.resourceId,
        status: { in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.AWAITING_VERIFICATION, BookingStatus.CONFIRMED] },
        startTime: { lt: booking.endTime }, endTime: { gt: booking.startTime }
      } });
      if (conflict) throw Object.assign(new Error('This time slot is no longer available. Contact staff for a new booking.'), { status: 409 });
    }
  }
  const addons = await prisma.bookingAddon.findMany({ where: { bookingId }, orderBy: { addonItemId: 'asc' } });
  for (const addon of addons) {
    if (!reservesStock(next)) {
      await prisma.addonItem.updateMany({ where: { id: addon.addonItemId, stock: { not: null } }, data: { stock: { increment: addon.quantity } } });
    } else {
      const item = await prisma.addonItem.findUnique({ where: { id: addon.addonItemId } });
      if (item?.stock === null) continue;
      const result = await prisma.addonItem.updateMany({ where: { id: addon.addonItemId, isAvailable: true, stock: { gte: addon.quantity } }, data: { stock: { decrement: addon.quantity } } });
      if (result.count !== 1) throw Object.assign(new Error('An add-on is no longer available. Contact staff before resubmitting payment.'), { status: 409 });
    }
  }
}
