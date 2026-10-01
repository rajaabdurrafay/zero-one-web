import { prisma } from '../db';
import { BookingStatus } from '@prisma/client';

/**
 * Auto-completes any CONFIRMED bookings whose endTime has already passed.
 * Returns the count of updated bookings.
 */
export async function autoCompleteExpiredBookings(): Promise<number> {
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
    return 0;
  }
}

/**
 * Automatically cancels PENDING_PAYMENT bookings and booking groups that have exceeded the 15-minute window
 * without a payment screenshot upload.
 */
export async function autoCancelExpiredPendingPayments(): Promise<number> {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // Cancel expired single & group bookings
    const result = await prisma.booking.updateMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lte: fifteenMinutesAgo }
      },
      data: {
        status: BookingStatus.CANCELLED
      }
    });

    // Also update any BookingGroup records that expired
    try {
      await (prisma as any).bookingGroup.updateMany({
        where: {
          status: BookingStatus.PENDING_PAYMENT,
          createdAt: { lte: fifteenMinutesAgo }
        },
        data: {
          status: BookingStatus.CANCELLED
        }
      });
    } catch {
      // Ignore if table/field not accessible yet
    }

    if (result.count > 0) {
      console.log(`[Auto-Expiry] ${result.count} expired pending payment booking(s) marked as CANCELLED.`);
    }

    return result.count;
  } catch (error) {
    console.error('[Auto-Expiry] Error cancelling expired pending payments:', error);
    return 0;
  }
}

