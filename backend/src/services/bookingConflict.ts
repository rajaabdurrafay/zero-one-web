import { prisma } from '../db';
export const reservingStatuses = ['PENDING','PENDING_PAYMENT','AWAITING_VERIFICATION','CONFIRMED'] as const;
// All writers hold the Resource row lock before using this check.
export async function hasConflict(resourceId: string, startTime: Date, endTime: Date, excludeBookingId?: string, excludeSessionId?: string): Promise<boolean> {
  const booking = await prisma.booking.findFirst({ where: { resourceId, status: { in: [...reservingStatuses] }, ...(excludeBookingId && { id: { not: excludeBookingId } }), startTime: { lt: endTime }, endTime: { gt: startTime } }, select: { id: true } });
  if (booking) return true;
  // An active table cannot promise a new reservation until it is stopped.
  const session = await prisma.session.findFirst({ where: { resourceId, status: { in: ['RUNNING','PAUSED'] }, ...(excludeSessionId && { id: { not: excludeSessionId } }), ...(excludeBookingId && { OR: [{ bookingId: null }, { bookingId: { not: excludeBookingId } }] }), startedAt: { lt: endTime } }, select: { id: true } });
  return session !== null;
}
