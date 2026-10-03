import { database, prisma, withinTransaction } from '../db';
import { BookingStatus } from '@prisma/client';
import { transitionBookingStock } from './bookingStock';

let lastCompletion = 0;
let lastCancellation = 0;

/**
 * Auto-completes any CONFIRMED bookings whose endTime has already passed.
 * Returns the count of updated bookings.
 */
export async function autoCompleteExpiredBookings(): Promise<number> {
  if (Date.now() - lastCompletion < 15_000) return 0;
  lastCompletion = Date.now();
  try {
    const now = new Date();
    // Only auto-complete confirmed bookings that DO NOT have an active or paused Live Session running
    const result = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.CONFIRMED,
        endTime: { lte: now },
        OR: [
          { session: null },
          { session: { status: 'COMPLETED' } }
        ]
      },
      data: {
        status: BookingStatus.COMPLETED
      }
    });

    if (result.count > 0) {
      console.log(`[Auto-Complete] ${result.count} past confirmed booking(s) automatically marked as COMPLETED.`);
    }

    return result.count;
  } catch (error) {
    console.error('[Auto-Complete] Error updating expired bookings:', error);
    lastCompletion = 0;
    return 0;
  }
}

/**
 * Automatically cancels PENDING_PAYMENT bookings and booking groups that have exceeded the 15-minute window
 * without a payment screenshot upload.
 */
export async function autoCancelExpiredPendingPayments(): Promise<number> {
  if (Date.now() - lastCancellation < 15_000) return 0;
  lastCancellation = Date.now();
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const candidates = await prisma.booking.findMany({
      where: { status: BookingStatus.PENDING_PAYMENT, createdAt: { lte: fifteenMinutesAgo } },
      select: { id: true, resourceId: true }, orderBy: { id: 'asc' }, take: 100
    });
    let count = 0;
    for (const candidate of candidates) {
      count += await database.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM Resource WHERE id = ${candidate.resourceId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM Booking WHERE id = ${candidate.id} FOR UPDATE`;
        const current = await tx.booking.findUnique({ where: { id: candidate.id } });
        if (!current || current.status !== BookingStatus.PENDING_PAYMENT || current.createdAt > fifteenMinutesAgo) return 0;
        await withinTransaction(tx, () => transitionBookingStock(current.id, current.status, BookingStatus.CANCELLED));
        await tx.booking.update({ where: { id: current.id }, data: { status: BookingStatus.CANCELLED } });
        if (current.bookingGroupId) {
          await tx.bookingGroup.updateMany({
            where: { id: current.bookingGroupId, status: BookingStatus.PENDING_PAYMENT, bookings: { every: { status: BookingStatus.CANCELLED } } },
            data: { status: BookingStatus.CANCELLED }
          });
        }
        return 1;
      }, { isolationLevel: 'ReadCommitted' });
    }
    const result = { count };

    if (result.count > 0) {
      console.log(`[Auto-Expiry] ${result.count} expired pending payment booking(s) marked as CANCELLED.`);
    }

    return result.count;
  } catch (error) {
    lastCancellation = 0;
    console.error('[Auto-Expiry] Error cancelling expired pending payments:', error);
    return 0;
  }
}
