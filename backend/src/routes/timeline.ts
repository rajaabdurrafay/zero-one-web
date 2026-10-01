import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { ResourceType, BookingStatus } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import { autoCancelExpiredPendingPayments, autoCompleteExpiredBookings } from '../services/bookingAutomation';

const router = Router();

const timelineQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resourceType: z.nativeEnum(ResourceType).optional(),
});

router.get('/', requireAdminAuth(), async (req, res, next) => {
  try {
    // Run automation tasks before querying
    await autoCancelExpiredPendingPayments();
    await autoCompleteExpiredBookings();

    const query = timelineQuerySchema.parse(req.query);
    const [year, month, day] = query.date.split('-').map(Number);

    // Pakistan Standard Time (UTC+5) boundaries for the selected date
    // PKT 00:00:00 = UTC (day - 5h)
    const startOfDay = new Date(Date.UTC(year, month - 1, day, -5, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 18, 59, 59, 999));

    const resources = await prisma.resource.findMany({
      where: {
        isActive: true,
        ...(query.resourceType && { type: query.resourceType }),
      },
      include: {
        bookings: {
          where: {
            startTime: { lt: endOfDay },
            endTime: { gt: startOfDay },
            status: {
              in: [
                BookingStatus.PENDING,
                BookingStatus.PENDING_PAYMENT,
                BookingStatus.AWAITING_VERIFICATION,
                BookingStatus.CONFIRMED,
                BookingStatus.COMPLETED,
              ],
            },
          },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                phone: true,
                email: true,
              },
            },
          },
          orderBy: {
            startTime: 'asc',
          },
        },
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' },
      ],
    });

    const now = new Date();

    const formattedResources = resources.map((res) => ({
      id: res.id,
      name: res.name,
      type: res.type,
      bookings: res.bookings.map((b) => ({
        id: b.id,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        totalPrice: b.totalPrice,
        isWalkIn: b.isWalkIn,
        customer: {
          id: b.customer.id,
          name: b.customer.name,
          phone: b.customer.phone,
          email: b.customer.email,
        },
      })),
    }));

    return res.json({
      date: query.date,
      serverTime: now.toISOString(),
      resources: formattedResources,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    next(error);
  }
});

export { router as timelineRouter };
