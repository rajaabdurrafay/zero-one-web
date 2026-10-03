import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ResourceType, BookingStatus } from '@prisma/client';
import { businessInstant } from '@zeroone/domain';
import { autoCancelExpiredPendingPayments, autoCompleteExpiredBookings } from '../services/bookingAutomation';

const router = Router();

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resourceType: z.nativeEnum(ResourceType).optional()
});

router.get('/', async (req, res, next) => {
  try {
    // Lazy evaluation: Cancel expired pending payments (15 mins) and complete past bookings
    await autoCancelExpiredPendingPayments();
    await autoCompleteExpiredBookings();

    const query = querySchema.parse(req.query);
    const [year, month, day] = query.date.split('-').map(Number);
    businessInstant(query.date);

    // Pakistan Standard Time (UTC+5) boundaries for the selected date
    // PKT 00:00:00 = UTC (day - 5h)
    const startOfDay = new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));

    const resources = await prisma.resource.findMany({
      where: {
        isActive: true,
        ...(query.resourceType && { type: query.resourceType })
      },
      include: {
        sessions: {where:{status:{in:['RUNNING','PAUSED']},startedAt:{lt:endOfDay}},select:{id:true,startedAt:true}},
        bookings: {
          where: {
            startTime: { lt: endOfDay },
            endTime: { gt: startOfDay },
            status: { in: [BookingStatus.PENDING, BookingStatus.PENDING_PAYMENT, BookingStatus.AWAITING_VERIFICATION, BookingStatus.CONFIRMED] }
          },
          select: {id:true,startTime:true,endTime:true},
          orderBy: { startTime: 'asc' }
        }
      }
    });

    const now = new Date();

    const availability = resources.map(resource => {
      const busySlots = resource.bookings.map(booking => ({
        bookingId: booking.id,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString()
      }));
      for (const session of resource.sessions) busySlots.push({bookingId:session.id,startTime:new Date(Math.max(startOfDay.getTime(),session.startedAt.getTime())).toISOString(),endTime:endOfDay.toISOString()});

      return {
        id: resource.id,
        name: resource.name,
        type: resource.type,
        busySlots
      };
    });

    res.json({
      date: query.date,
      serverTime: now.toISOString(),
      resources: availability
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    next(error);
  }
});

export { router as availabilityRouter };
