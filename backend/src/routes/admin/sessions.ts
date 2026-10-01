import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db';
import { SessionMode, SessionStatus, SessionAction, BookingStatus, PricingUnit } from '@prisma/client';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../../middleware/adminAuth';

const router = Router();

// Validation Schemas
const startSessionSchema = z.object({
  resourceId: z.string().cuid(),
  bookingId: z.string().optional().nullable(),
  customerName: z.string().optional().nullable(),
  mode: z.nativeEnum(SessionMode),
  plannedMinutes: z.number().int().positive().optional().nullable(),
});

const sessionActionSchema = z.object({
  action: z.nativeEnum(SessionAction),
  minutes: z.number().int().positive().optional(),
});

const stopSessionSchema = z.object({
  paymentMethod: z.enum(['CASH', 'ONLINE_JAZZCASH', 'ONLINE_EASYPAISA', 'ONLINE_BANK']).optional().default('CASH'),
});

// Helper: Calculate session bill amount based on Resource and Duration
async function calculateSessionBill(resourceId: string, durationMinutes: number): Promise<number> {
  const resource = await prisma.resource.findUnique({
    where: { id: resourceId }
  });

  if (!resource) {
    throw new Error('Resource not found');
  }

  const activity = await prisma.activity.findUnique({
    where: { resourceType: resource.type }
  });

  if (!activity) {
    throw new Error('Activity pricing not found');
  }

  // Tiered pricing check
  if (
    activity.halfHourPrice !== null &&
    activity.halfHourPrice !== undefined &&
    activity.fullHourPrice !== null &&
    activity.fullHourPrice !== undefined
  ) {
    const totalHours = Math.floor(durationMinutes / 60);
    const remainingMinutes = durationMinutes % 60;
    let price = totalHours * activity.fullHourPrice;

    if (remainingMinutes === 30) {
      price += activity.halfHourPrice;
    } else if (remainingMinutes > 0) {
      price += (activity.halfHourPrice / 30) * remainingMinutes;
    }
    return Math.round(price);
  }

  if (activity.pricingUnit === PricingUnit.PER_MINUTE) {
    return Math.round(durationMinutes * activity.basePrice);
  } else {
    return Math.round((durationMinutes / 60) * activity.basePrice);
  }
}

// 1. GET /api/admin/sessions -> List all resources with their active live session (or status)
router.get('/', requireAdminAuth(), async (req, res, next) => {
  try {
    const resources = await prisma.resource.findMany({
      where: { isActive: true },
      include: {
        sessions: {
          where: {
            status: { in: [SessionStatus.RUNNING, SessionStatus.PAUSED] }
          },
          include: {
            booking: {
              include: {
                customer: true,
                addons: {
                  include: {
                    addonItem: true
                  }
                }
              }
            },
            startedByUser: {
              select: {
                id: true,
                name: true,
                username: true
              }
            },
            logs: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: {
                performedByUser: {
                  select: { id: true, name: true }
                }
              }
            }
          },
          orderBy: { startedAt: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { type: 'asc' },
        { name: 'asc' }
      ]
    });

    const activeSessionsMatrix = resources.map((resource) => {
      const activeSession = resource.sessions[0] || null;
      return {
        resourceId: resource.id,
        resourceName: resource.name,
        resourceType: resource.type,
        activeSession: activeSession
          ? {
              ...activeSession,
              customerDisplay:
                activeSession.booking?.customer?.name ||
                activeSession.customerName ||
                'Walk-in Guest',
              customerPhone: activeSession.booking?.customer?.phone || null,
            }
          : null
      };
    });

    res.json(activeSessionsMatrix);
  } catch (error) {
    next(error);
  }
});

// 2. GET /api/admin/sessions/active -> Lightweight active list for global alerts / badge counters
router.get('/active', requireAdminAuth(), async (req, res, next) => {
  try {
    const activeSessions = await prisma.session.findMany({
      where: {
        status: { in: [SessionStatus.RUNNING, SessionStatus.PAUSED] }
      },
      include: {
        resource: {
          select: { id: true, name: true, type: true }
        },
        booking: {
          select: {
            id: true,
            customer: {
              select: { name: true, phone: true }
            }
          }
        }
      }
    });

    res.json(activeSessions);
  } catch (error) {
    next(error);
  }
});

// 3. POST /api/admin/sessions -> Start a new live session
router.post('/', requireAdminAuth(), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const data = startSessionSchema.parse(req.body);
    const adminId = req.admin!.id;

    // Check if resource is already in an active session
    const existingActive = await prisma.session.findFirst({
      where: {
        resourceId: data.resourceId,
        status: { in: [SessionStatus.RUNNING, SessionStatus.PAUSED] }
      }
    });

    if (existingActive) {
      return res.status(400).json({
        error: 'Resource is already in an active session',
        sessionId: existingActive.id
      });
    }

    let booking = null;
    let customerName = data.customerName || null;
    let plannedMinutes = data.plannedMinutes || null;

    // If starting from an existing booking
    if (data.bookingId) {
      booking = await prisma.booking.findUnique({
        where: { id: data.bookingId },
        include: { customer: true }
      });

      if (!booking) {
        return res.status(404).json({ error: 'Linked booking not found' });
      }

      customerName = booking.customer.name;

      if (data.mode === SessionMode.COUNTDOWN && !plannedMinutes) {
        // Compute duration from booking startTime & endTime
        const durationMinutes = Math.round(
          (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60)
        );
        plannedMinutes = durationMinutes > 0 ? durationMinutes : 60;
      }
    }

    // Default plannedMinutes for COUNTDOWN if not provided
    if (data.mode === SessionMode.COUNTDOWN && !plannedMinutes) {
      plannedMinutes = 60;
    }

    // Create session record & initial START log
    const session = await prisma.session.create({
      data: {
        resourceId: data.resourceId,
        bookingId: data.bookingId || null,
        customerName,
        mode: data.mode,
        status: SessionStatus.RUNNING,
        plannedMinutes: data.mode === SessionMode.COUNTDOWN ? plannedMinutes : null,
        startedByUserId: adminId,
        logs: {
          create: {
            action: SessionAction.START,
            performedByUserId: adminId,
            details: `Session started (${data.mode}${plannedMinutes ? ` - ${plannedMinutes} mins` : ''})`
          }
        }
      },
      include: {
        resource: true,
        booking: {
          include: { customer: true }
        },
        logs: true
      }
    });

    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid session data', details: error.errors });
    }
    next(error);
  }
});

// 4. PATCH /api/admin/sessions/:id/action -> Multi-tool action (PAUSE, RESUME, EXTEND)
router.patch('/:id/action', requireAdminAuth(), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const { action, minutes } = sessionActionSchema.parse(req.body);
    const adminId = req.admin!.id;

    const session = await prisma.session.findUnique({
      where: { id },
      include: { booking: true, resource: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === SessionStatus.COMPLETED) {
      return res.status(400).json({ error: 'Cannot modify a completed session' });
    }

    const now = new Date();

    if (action === SessionAction.PAUSE) {
      if (session.status === SessionStatus.PAUSED) {
        return res.status(400).json({ error: 'Session is already paused' });
      }

      const updated = await prisma.session.update({
        where: { id },
        data: {
          status: SessionStatus.PAUSED,
          pausedAt: now,
          logs: {
            create: {
              action: SessionAction.PAUSE,
              performedByUserId: adminId,
              details: 'Session paused by operator'
            }
          }
        },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } }
      });

      return res.json(updated);
    }

    if (action === SessionAction.RESUME) {
      if (session.status !== SessionStatus.PAUSED) {
        return res.status(400).json({ error: 'Session is not paused' });
      }

      const pausedDurationSec = session.pausedAt
        ? Math.max(0, Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000))
        : 0;

      const updated = await prisma.session.update({
        where: { id },
        data: {
          status: SessionStatus.RUNNING,
          pausedAt: null,
          totalPausedSeconds: session.totalPausedSeconds + pausedDurationSec,
          logs: {
            create: {
              action: SessionAction.RESUME,
              performedByUserId: adminId,
              details: `Session resumed (paused for ${Math.round(pausedDurationSec / 60)} mins)`
            }
          }
        },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } }
      });

      return res.json(updated);
    }

    if (action === SessionAction.EXTEND) {
      if (!minutes || minutes <= 0) {
        return res.status(400).json({ error: 'Must provide positive minutes to extend' });
      }

      // If tied to a booking, recalculate booking end time & total price
      if (session.bookingId && session.booking) {
        const newEndTime = new Date(session.booking.endTime.getTime() + minutes * 60 * 1000);
        const additionalPrice = await calculateSessionBill(session.resourceId, minutes);

        await prisma.booking.update({
          where: { id: session.bookingId },
          data: {
            endTime: newEndTime,
            totalPrice: session.booking.totalPrice + additionalPrice
          }
        });
      }

      const updated = await prisma.session.update({
        where: { id },
        data: {
          extendedMinutes: session.extendedMinutes + minutes,
          logs: {
            create: {
              action: SessionAction.EXTEND,
              performedByUserId: adminId,
              details: `Session extended by +${minutes} minutes`
            }
          }
        },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 5 } }
      });

      return res.json(updated);
    }

    return res.status(400).json({ error: 'Unsupported action' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid action payload', details: error.errors });
    }
    next(error);
  }
});

// 5. POST /api/admin/sessions/:id/stop -> Stop session, calculate bill, reconcile booking
router.post('/:id/stop', requireAdminAuth(), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = stopSessionSchema.parse(req.body);
    const adminId = req.admin!.id;
    const now = new Date();

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            customer: true,
            addons: true
          }
        },
        resource: true
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === SessionStatus.COMPLETED) {
      return res.status(400).json({ error: 'Session is already completed' });
    }

    // Calculate actual elapsed active minutes
    let extraPaused = 0;
    if (session.status === SessionStatus.PAUSED && session.pausedAt) {
      extraPaused = Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000);
    }
    const totalPausedSeconds = session.totalPausedSeconds + extraPaused;
    const totalElapsedSeconds = Math.max(
      0,
      Math.floor((now.getTime() - session.startedAt.getTime()) / 1000) - totalPausedSeconds
    );
    const totalElapsedMinutes = Math.max(1, Math.ceil(totalElapsedSeconds / 60));

    let finalAmount = 0;

    if (session.booking) {
      // For existing bookings:
      // If COUNTDOWN, the booking totalPrice already covers planned + extended time.
      // If COUNT_UP, compute exact price based on elapsed minutes.
      if (session.mode === SessionMode.COUNT_UP) {
        const baseActivityCost = await calculateSessionBill(session.resourceId, totalElapsedMinutes);
        const addonsCost = session.booking.addons.reduce(
          (sum, a) => sum + a.priceAtBooking * a.quantity,
          0
        );
        finalAmount = baseActivityCost + addonsCost;

        await prisma.booking.update({
          where: { id: session.bookingId! },
          data: {
            endTime: now,
            totalPrice: finalAmount,
            status: BookingStatus.COMPLETED
          }
        });
      } else {
        finalAmount = session.booking.totalPrice;
        await prisma.booking.update({
          where: { id: session.bookingId! },
          data: {
            status: BookingStatus.COMPLETED
          }
        });
      }
    } else {
      // Walk-in direct without prior booking record
      finalAmount = await calculateSessionBill(
        session.resourceId,
        session.mode === SessionMode.COUNTDOWN
          ? (session.plannedMinutes || 60) + session.extendedMinutes
          : totalElapsedMinutes
      );

      // Create or find a Walk-In customer record
      let walkInCustomer = await prisma.customer.findFirst({
        where: { phone: '0000000000' }
      });

      if (!walkInCustomer) {
        walkInCustomer = await prisma.customer.create({
          data: {
            name: session.customerName || 'Walk-in Guest',
            phone: '0000000000',
            isRegistered: false
          }
        });
      }

      // Create completed booking to record revenue in dashboard & analytics
      await prisma.booking.create({
        data: {
          resourceId: session.resourceId,
          customerId: walkInCustomer.id,
          startTime: session.startedAt,
          endTime: now,
          status: BookingStatus.COMPLETED,
          totalPrice: finalAmount,
          isWalkIn: true,
          paymentMethod: body.paymentMethod as any,
          amountPaid: finalAmount,
          verifiedAt: now
        }
      });
    }

    const completedSession = await prisma.session.update({
      where: { id },
      data: {
        status: SessionStatus.COMPLETED,
        endedAt: now,
        finalAmount,
        totalPausedSeconds,
        logs: {
          create: {
            action: SessionAction.STOP,
            performedByUserId: adminId,
            details: `Session stopped. Final Duration: ${totalElapsedMinutes} mins. Bill: Rs ${finalAmount.toLocaleString()}`
          }
        }
      },
      include: {
        logs: { orderBy: { createdAt: 'desc' } },
        resource: true
      }
    });

    res.json({
      message: 'Session completed successfully',
      session: completedSession,
      totalElapsedMinutes,
      finalAmount
    });
  } catch (error) {
    next(error);
  }
});

export { router as sessionsRouter };
export default router;
