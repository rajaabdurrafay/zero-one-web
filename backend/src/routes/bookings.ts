import { Router } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { prisma } from '../db';
import { BookingStatus, PaymentMethod, ResourceType } from '@prisma/client';
import { autoCompleteExpiredBookings, autoCancelExpiredPendingPayments } from '../services/bookingAutomation';
import { requireCustomerAuth, optionalCustomerAuth, AuthenticatedCustomerRequest } from '../middleware/customerAuth';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';
import { verifyAdminToken } from '../utils/auth';
import { getOrCreateSystemSettings } from './systemSettings';
import { createAuditLog } from '../utils/auditLogger';

const router = Router();

const createBookingSchema = z.object({
  resourceId: z.string().cuid(),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
    email: z.string().email().optional()
  }),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isWalkIn: z.boolean().optional().default(false),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  amountPaid: z.number().optional(),
  screenshotBase64: z.string().optional(),
  promoCode: z.string().optional().nullable(),
  offerId: z.string().optional().nullable(),
  addons: z.array(
    z.object({
      addonItemId: z.string(),
      quantity: z.number().int().min(1)
    })
  ).optional()
});

const createGroupBookingSchema = z.object({
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
    email: z.string().email().optional()
  }),
  isWalkIn: z.boolean().optional().default(false),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  amountPaid: z.number().optional(),
  screenshotBase64: z.string().optional(),
  items: z.array(
    z.object({
      resourceId: z.string().cuid(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      promoCode: z.string().optional().nullable(),
      offerId: z.string().optional().nullable()
    })
  ).min(1, 'At least one activity item is required in a group booking'),
  addons: z.array(
    z.object({
      addonItemId: z.string(),
      quantity: z.number().int().min(1)
    })
  ).optional()
});

const updateBookingSchema = z.object({
  status: z.nativeEnum(BookingStatus).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  amountPaid: z.number().optional(),
  reminderSent: z.boolean().optional(),
  verifiedAt: z.string().datetime().optional(),
  rejectionReason: z.string().optional()
});

// Check for time conflicts: (existing.startTime < new.endTime) AND (existing.endTime > new.startTime)
async function hasConflict(resourceId: string, startTime: Date, endTime: Date, excludeBookingId?: string) {
  const conflicts = await prisma.booking.findMany({
    where: {
      resourceId,
      status: {
        in: [
          BookingStatus.PENDING,
          BookingStatus.PENDING_PAYMENT,
          BookingStatus.AWAITING_VERIFICATION,
          BookingStatus.CONFIRMED
        ]
      },
      ...(excludeBookingId && { id: { not: excludeBookingId } }),
      startTime: { lt: endTime },
      endTime: { gt: startTime }
    }
  });

  return conflicts.length > 0;
}

// Calculate price based on activity pricing
async function calculatePrice(resourceId: string, startTime: Date, endTime: Date): Promise<number> {
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
    throw new Error('Activity pricing not configured');
  }

  const durationMs = endTime.getTime() - startTime.getTime();
  const durationInMinutes = Math.ceil(durationMs / (1000 * 60));

  // Tiered / Slab pricing (if both halfHourPrice and fullHourPrice are configured)
  if (activity.halfHourPrice !== null && activity.halfHourPrice !== undefined &&
      activity.fullHourPrice !== null && activity.fullHourPrice !== undefined) {
    const totalHours = Math.floor(durationInMinutes / 60);
    const remainingMinutes = durationInMinutes % 60;
    let price = totalHours * activity.fullHourPrice;

    if (remainingMinutes === 30) {
      price += activity.halfHourPrice;
    } else if (remainingMinutes > 0) {
      // Prorate remaining minutes based on half-hour rate
      price += (activity.halfHourPrice / 30) * remainingMinutes;
    }

    return Math.round(price);
  }

  // Regular linear pricing
  if (activity.pricingUnit === 'PER_MINUTE') {
    return Math.round(durationInMinutes * activity.basePrice);
  } else {
    // PER_HOUR: exact prorated calculation (e.g. 90 mins @ Rs 800/hr = Rs 1200)
    return Math.round((durationInMinutes / 60) * activity.basePrice);
  }
}

// POST /api/bookings - Create booking
router.post('/', optionalCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const data = createBookingSchema.parse(req.body);

    // Determine if the request is from an authenticated Admin
    const authHeader = req.headers.authorization;
    const customAdminToken = req.headers['x-admin-token'] as string | undefined;
    let adminToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      adminToken = authHeader.substring(7);
    } else if (customAdminToken) {
      adminToken = customAdminToken;
    }
    const adminUser = adminToken ? verifyAdminToken(adminToken) : null;
    const isAdminRequest = Boolean(adminUser);

    // System Settings Check (Maintenance Mode, Online Bookings Toggle, Emergency Closed)
    const systemSettings = await getOrCreateSystemSettings();

    // 1. If Maintenance Mode is active and this is NOT an admin request -> reject
    if (systemSettings.maintenanceMode && !isAdminRequest) {
      return res.status(503).json({
        error: 'System Under Maintenance',
        message: systemSettings.maintenanceMessage || 'The system is currently undergoing scheduled maintenance. Please try again shortly.',
      });
    }

    // 2. If Emergency Closed is active:
    // Non-admin bookings are blocked for today
    if (systemSettings.emergencyClosedToday && !isAdminRequest) {
      return res.status(403).json({
        error: 'Facility Closed Today',
        message: systemSettings.emergencyClosedMessage || 'We are closed for today due to maintenance or a special event.',
      });
    }

    // 3. If Online Bookings are paused and this is a customer/online booking request
    if (!systemSettings.bookingsEnabled && !isAdminRequest && !data.isWalkIn) {
      return res.status(400).json({
        error: 'Online Bookings Paused',
        message: systemSettings.bookingsPausedMessage || 'Online bookings are temporarily paused. Please call us directly to book.',
      });
    }

    // 4. If Walk-in bookings are disabled (rare lockdown) and it's a walk-in
    if (data.isWalkIn && !systemSettings.walkInsEnabled && !isAdminRequest) {
      return res.status(400).json({
        error: 'Walk-in Bookings Paused',
        message: 'Walk-in bookings are temporarily paused.',
      });
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const now = new Date();

    if (endTime <= startTime) {
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    // Past time validation: reject booking if startTime is in the past
    if (startTime < now) {
      return res.status(400).json({
        error: 'Invalid time slot',
        message: 'Cannot book a time slot in the past'
      });
    }

    // Future limit validation: reject booking if startTime is more than 7 days ahead
    const maxFutureDate = new Date(now);
    maxFutureDate.setDate(maxFutureDate.getDate() + 7);
    maxFutureDate.setHours(23, 59, 59, 999);
    if (startTime > maxFutureDate) {
      return res.status(400).json({
        error: 'Booking too far in advance',
        message: 'Bookings can only be made up to 7 days in advance'
      });
    }

    // Validate minimum duration for PER_MINUTE activities (minimum 30 minutes)
    const resource = await prisma.resource.findUnique({
      where: { id: data.resourceId }
    });

    if (!resource) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const activity = await prisma.activity.findUnique({
      where: { resourceType: resource.type }
    });

    if (!activity) {
      return res.status(404).json({ error: 'Activity pricing not configured' });
    }

    const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

    const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

    // Validate minimum duration: 30 minutes if tiered or PER_MINUTE, 60 minutes for strictly PER_HOUR
    if ((hasTiered || activity.pricingUnit === 'PER_MINUTE') && durationMinutes < 30) {
      return res.status(400).json({
        error: 'Minimum booking duration',
        message: 'Minimum booking duration for this activity is 30 minutes.'
      });
    }

    if (!hasTiered && activity.pricingUnit === 'PER_HOUR' && durationMinutes < 60) {
      return res.status(400).json({
        error: 'Minimum booking duration',
        message: 'Minimum booking duration for this activity is 1 hour (60 minutes).'
      });
    }

    // Check for conflicts
    const hasConflictingBooking = await hasConflict(data.resourceId, startTime, endTime);

    if (hasConflictingBooking) {
      return res.status(409).json({
        error: 'Time slot conflict',
        message: 'This resource is already booked for the requested time slot'
      });
    }

    // Calculate total price
    let totalPrice = await calculatePrice(data.resourceId, startTime, endTime);
    let discountAmount = 0;
    let appliedOfferId: string | undefined = undefined;

    // Check & apply deal/promo discount if provided
    if (data.promoCode || data.offerId) {
      const offer = await (prisma as any).offer.findFirst({
        where: {
          ...(data.offerId ? { id: data.offerId } : {}),
          ...(data.promoCode ? { promoCode: data.promoCode.trim().toUpperCase() } : {}),
          isActive: true,
          validFrom: { lte: now },
          validUntil: { gte: now }
        }
      });

      if (offer) {
        let isEligible = true;
        if (offer.applicableTo === 'SPECIFIC_ACTIVITY' && offer.activityId && offer.activityId !== activity.id) {
          isEligible = false;
        }
        if (offer.minDuration && durationMinutes < offer.minDuration) {
          isEligible = false;
        }

        if (isEligible) {
          appliedOfferId = offer.id;
          if (offer.discountType === 'PERCENTAGE') {
            discountAmount = Math.round((totalPrice * offer.discountValue) / 100);
          } else {
            discountAmount = Math.min(totalPrice, Math.round(offer.discountValue));
          }
          totalPrice = Math.max(0, totalPrice - discountAmount);
        }
      }
    }

    // Find or link customer
    let customer;
    if (req.customer && req.customer.customerId) {
      // User is authenticated as customer - link directly to logged-in customer
      customer = await prisma.customer.findUnique({
        where: { id: req.customer.customerId }
      });
    }

    if (!customer && data.customer?.phone) {
      customer = await prisma.customer.findFirst({
        where: { phone: data.customer.phone }
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email || null,
          isRegistered: false
        }
      });
    }

    // Process optional screenshot if provided directly in creation (e.g. walk-in online receipt)
    let paymentScreenshotUrl: string | undefined = undefined;
    let paymentSubmittedAt: Date | undefined = undefined;

    if (data.screenshotBase64) {
      try {
        let base64Data = data.screenshotBase64;
        let ext = 'png';
        const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
        if (match) {
          ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
        }
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length <= 5 * 1024 * 1024) {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const fileName = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          paymentScreenshotUrl = `/uploads/${fileName}`;
          paymentSubmittedAt = new Date();
        }
      } catch (err) {
        console.error('Failed to save POS screenshot:', err);
      }
    }

    // Process and validate Add-ons if provided
    let addonItemsToCreate: Array<{ addonItemId: string; quantity: number; priceAtBooking: number }> = [];
    if (data.addons && data.addons.length > 0) {
      for (const addonReq of data.addons) {
        const addonDb = await prisma.addonItem.findUnique({
          where: { id: addonReq.addonItemId }
        });

        if (!addonDb) {
          return res.status(404).json({
            error: 'Addon not found',
            message: `Selected add-on item was not found.`
          });
        }

        if (!addonDb.isAvailable) {
          return res.status(400).json({
            error: 'Addon unavailable',
            message: `${addonDb.name} is currently out of stock / unavailable.`
          });
        }

        if (addonDb.stock !== null && addonDb.stock !== undefined) {
          if (addonDb.stock < addonReq.quantity) {
            return res.status(400).json({
              error: 'Insufficient stock',
              message: `Only ${addonDb.stock} left in stock for ${addonDb.name}.`
            });
          }
        }

        const itemTotal = addonDb.price * addonReq.quantity;
        totalPrice += itemTotal;

        addonItemsToCreate.push({
          addonItemId: addonDb.id,
          quantity: addonReq.quantity,
          priceAtBooking: addonDb.price
        });
      }
    }

    // Deduct stock for chosen items
    if (addonItemsToCreate.length > 0) {
      for (const item of addonItemsToCreate) {
        const dbItem = await prisma.addonItem.findUnique({ where: { id: item.addonItemId } });
        if (dbItem && dbItem.stock !== null && dbItem.stock !== undefined) {
          await prisma.addonItem.update({
            where: { id: item.addonItemId },
            data: {
              stock: Math.max(0, dbItem.stock - item.quantity)
            }
          });
        }
      }
    }

    // Create booking:
    // Online bookings default to PENDING_PAYMENT (15-min slot hold)
    // Walk-in bookings are CONFIRMED immediately
    const initialStatus = data.isWalkIn ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT;
    const defaultPaymentMethod = data.paymentMethod || (data.isWalkIn ? PaymentMethod.CASH : undefined);

    const booking = await prisma.booking.create({
      data: {
        resourceId: data.resourceId,
        customerId: customer.id,
        startTime,
        endTime,
        totalPrice,
        discountAmount,
        appliedOfferId,
        isWalkIn: data.isWalkIn,
        status: initialStatus,
        paymentMethod: defaultPaymentMethod,
        amountPaid: data.amountPaid,
        paymentScreenshotUrl,
        paymentSubmittedAt,
        verifiedAt: data.isWalkIn ? new Date() : undefined,
        ...(addonItemsToCreate.length > 0 && {
          addons: {
            create: addonItemsToCreate.map((a) => ({
              addonItemId: a.addonItemId,
              quantity: a.quantity,
              priceAtBooking: a.priceAtBooking
            }))
          }
        })
      },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true,
        addons: {
          include: {
            addonItem: true
          }
        }
      }
    });

    res.status(201).json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// POST /api/bookings/group - Create multiple activity bookings in a single group
router.post('/group', optionalCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const data = createGroupBookingSchema.parse(req.body);

    // Determine if the request is from an authenticated Admin
    const authHeader = req.headers.authorization;
    const customAdminToken = req.headers['x-admin-token'] as string | undefined;
    let adminToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      adminToken = authHeader.substring(7);
    } else if (customAdminToken) {
      adminToken = customAdminToken;
    }
    const adminUser = adminToken ? verifyAdminToken(adminToken) : null;
    const isAdminRequest = Boolean(adminUser);

    // System Settings Check (Maintenance Mode, Online Bookings Toggle, Emergency Closed)
    const systemSettings = await getOrCreateSystemSettings();

    if (systemSettings.maintenanceMode && !isAdminRequest) {
      return res.status(503).json({
        error: 'System Under Maintenance',
        message: systemSettings.maintenanceMessage || 'The system is currently undergoing scheduled maintenance. Please try again shortly.',
      });
    }

    if (systemSettings.emergencyClosedToday && !isAdminRequest) {
      return res.status(403).json({
        error: 'Facility Closed Today',
        message: systemSettings.emergencyClosedMessage || 'We are closed for today due to maintenance or a special event.',
      });
    }

    if (!systemSettings.bookingsEnabled && !isAdminRequest && !data.isWalkIn) {
      return res.status(400).json({
        error: 'Online Bookings Paused',
        message: systemSettings.bookingsPausedMessage || 'Online bookings are temporarily paused. Please call us directly to book.',
      });
    }

    if (data.isWalkIn && !systemSettings.walkInsEnabled && !isAdminRequest) {
      return res.status(400).json({
        error: 'Walk-in Bookings Paused',
        message: 'Walk-in bookings are temporarily paused.',
      });
    }

    const now = new Date();
    const maxFutureDate = new Date(now);
    maxFutureDate.setDate(maxFutureDate.getDate() + 7);
    maxFutureDate.setHours(23, 59, 59, 999);

    // Item validation and calculation
    const validatedItems: Array<{
      resourceId: string;
      startTime: Date;
      endTime: Date;
      totalPrice: number;
      discountAmount: number;
      appliedOfferId?: string;
      resourceName: string;
      activityName: string;
    }> = [];

    let groupTotalAmount = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const startTime = new Date(item.startTime);
      const endTime = new Date(item.endTime);

      if (endTime <= startTime) {
        return res.status(400).json({
          error: 'Invalid time slot',
          message: `Item #${i + 1}: End time must be after start time`
        });
      }

      if (startTime < now) {
        return res.status(400).json({
          error: 'Invalid time slot',
          message: `Item #${i + 1}: Cannot book a time slot in the past`,
          itemIndex: i
        });
      }

      if (startTime > maxFutureDate) {
        return res.status(400).json({
          error: 'Booking too far in advance',
          message: `Item #${i + 1}: Bookings can only be made up to 7 days in advance`,
          itemIndex: i
        });
      }

      const resource = await prisma.resource.findUnique({
        where: { id: item.resourceId }
      });

      if (!resource) {
        return res.status(404).json({
          error: 'Resource not found',
          message: `Item #${i + 1}: Selected resource does not exist`,
          itemIndex: i
        });
      }

      const activity = await prisma.activity.findUnique({
        where: { resourceType: resource.type }
      });

      if (!activity) {
        return res.status(404).json({
          error: 'Activity pricing not configured',
          message: `Item #${i + 1}: Activity pricing not found`,
          itemIndex: i
        });
      }

      const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);
      const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

      if ((hasTiered || activity.pricingUnit === 'PER_MINUTE') && durationMinutes < 30) {
        return res.status(400).json({
          error: 'Minimum booking duration',
          message: `Item #${i + 1} (${resource.name}): Minimum booking duration is 30 minutes.`,
          itemIndex: i
        });
      }

      if (!hasTiered && activity.pricingUnit === 'PER_HOUR' && durationMinutes < 60) {
        return res.status(400).json({
          error: 'Minimum booking duration',
          message: `Item #${i + 1} (${resource.name}): Minimum booking duration is 1 hour (60 minutes).`,
          itemIndex: i
        });
      }

      // Check slot conflict per item
      const hasConflictingBooking = await hasConflict(item.resourceId, startTime, endTime);
      if (hasConflictingBooking) {
        return res.status(409).json({
          error: 'Time slot conflict',
          message: `Item #${i + 1} (${resource.name}): This time slot is already booked. Please choose another slot.`,
          itemIndex: i,
          resourceId: item.resourceId
        });
      }

      // Calculate price
      let itemPrice = await calculatePrice(item.resourceId, startTime, endTime);
      let itemDiscount = 0;
      let appliedOfferId: string | undefined = undefined;

      if (item.promoCode || item.offerId) {
        const offer = await (prisma as any).offer.findFirst({
          where: {
            ...(item.offerId ? { id: item.offerId } : {}),
            ...(item.promoCode ? { promoCode: item.promoCode.trim().toUpperCase() } : {}),
            isActive: true,
            validFrom: { lte: now },
            validUntil: { gte: now }
          }
        });

        if (offer) {
          let isEligible = true;
          if (offer.applicableTo === 'SPECIFIC_ACTIVITY' && offer.activityId && offer.activityId !== activity.id) {
            isEligible = false;
          }
          if (offer.minDuration && durationMinutes < offer.minDuration) {
            isEligible = false;
          }

          if (isEligible) {
            appliedOfferId = offer.id;
            if (offer.discountType === 'PERCENTAGE') {
              itemDiscount = Math.round((itemPrice * offer.discountValue) / 100);
            } else {
              itemDiscount = Math.min(itemPrice, Math.round(offer.discountValue));
            }
            itemPrice = Math.max(0, itemPrice - itemDiscount);
          }
        }
      }

      groupTotalAmount += itemPrice;
      validatedItems.push({
        resourceId: item.resourceId,
        startTime,
        endTime,
        totalPrice: itemPrice,
        discountAmount: itemDiscount,
        appliedOfferId,
        resourceName: resource.name,
        activityName: activity.name
      });
    }

    // Find or create customer
    let customer;
    if (req.customer && req.customer.customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: req.customer.customerId }
      });
    }

    if (!customer && data.customer?.phone) {
      customer = await prisma.customer.findFirst({
        where: { phone: data.customer.phone }
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: data.customer.name,
          phone: data.customer.phone,
          email: data.customer.email || null,
          isRegistered: false
        }
      });
    }

    // Process optional screenshot if provided directly
    let paymentScreenshotUrl: string | undefined = undefined;
    let paymentSubmittedAt: Date | undefined = undefined;

    if (data.screenshotBase64) {
      try {
        let base64Data = data.screenshotBase64;
        let ext = 'png';
        const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
        if (match) {
          ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
        }
        const buffer = Buffer.from(base64Data, 'base64');
        if (buffer.length <= 5 * 1024 * 1024) {
          const uploadsDir = path.join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const fileName = `pos_grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, buffer);
          paymentScreenshotUrl = `/uploads/${fileName}`;
          paymentSubmittedAt = new Date();
        }
      } catch (err) {
        console.error('Failed to save POS screenshot for group booking:', err);
      }
    }

    const initialStatus = data.isWalkIn ? BookingStatus.CONFIRMED : BookingStatus.PENDING_PAYMENT;
    const defaultPaymentMethod = data.paymentMethod || (data.isWalkIn ? PaymentMethod.CASH : undefined);

    // Process group-level add-ons if provided
    let groupAddonItemsToCreate: Array<{ addonItemId: string; quantity: number; priceAtBooking: number }> = [];
    if (data.addons && data.addons.length > 0) {
      for (const addonReq of data.addons) {
        const addonDb = await prisma.addonItem.findUnique({
          where: { id: addonReq.addonItemId }
        });

        if (!addonDb) {
          return res.status(404).json({
            error: 'Addon not found',
            message: `Selected add-on item was not found.`
          });
        }

        if (!addonDb.isAvailable) {
          return res.status(400).json({
            error: 'Addon unavailable',
            message: `${addonDb.name} is currently out of stock / unavailable.`
          });
        }

        if (addonDb.stock !== null && addonDb.stock !== undefined) {
          if (addonDb.stock < addonReq.quantity) {
            return res.status(400).json({
              error: 'Insufficient stock',
              message: `Only ${addonDb.stock} left in stock for ${addonDb.name}.`
            });
          }
        }

        const itemTotal = addonDb.price * addonReq.quantity;
        groupTotalAmount += itemTotal;

        groupAddonItemsToCreate.push({
          addonItemId: addonDb.id,
          quantity: addonReq.quantity,
          priceAtBooking: addonDb.price
        });
      }
    }

    // Deduct stock for chosen items
    if (groupAddonItemsToCreate.length > 0) {
      for (const item of groupAddonItemsToCreate) {
        const dbItem = await prisma.addonItem.findUnique({ where: { id: item.addonItemId } });
        if (dbItem && dbItem.stock !== null && dbItem.stock !== undefined) {
          await prisma.addonItem.update({
            where: { id: item.addonItemId },
            data: {
              stock: Math.max(0, dbItem.stock - item.quantity)
            }
          });
        }
      }
    }

    // Create the parent BookingGroup record
    const bookingGroup = await (prisma as any).bookingGroup.create({
      data: {
        customerId: customer.id,
        totalAmount: groupTotalAmount,
        status: initialStatus,
        paymentMethod: defaultPaymentMethod,
        amountPaid: data.amountPaid || (data.isWalkIn ? groupTotalAmount : undefined),
        paymentScreenshotUrl,
        paymentSubmittedAt,
        verifiedAt: data.isWalkIn ? new Date() : undefined
      }
    });

    // Create all child booking records linked to bookingGroup.id (attach addons to first child booking)
    const createdBookings = await Promise.all(
      validatedItems.map((item, index) =>
        prisma.booking.create({
          data: {
            bookingGroupId: bookingGroup.id,
            resourceId: item.resourceId,
            customerId: customer!.id,
            startTime: item.startTime,
            endTime: item.endTime,
            totalPrice: index === 0 && groupAddonItemsToCreate.length > 0
              ? item.totalPrice + groupAddonItemsToCreate.reduce((sum, a) => sum + a.priceAtBooking * a.quantity, 0)
              : item.totalPrice,
            discountAmount: item.discountAmount,
            appliedOfferId: item.appliedOfferId,
            isWalkIn: data.isWalkIn,
            status: initialStatus,
            paymentMethod: defaultPaymentMethod,
            amountPaid: data.isWalkIn ? item.totalPrice : undefined,
            paymentScreenshotUrl,
            paymentSubmittedAt,
            verifiedAt: data.isWalkIn ? new Date() : undefined,
            ...(index === 0 && groupAddonItemsToCreate.length > 0 && {
              addons: {
                create: groupAddonItemsToCreate.map((a) => ({
                  addonItemId: a.addonItemId,
                  quantity: a.quantity,
                  priceAtBooking: a.priceAtBooking
                }))
              }
            })
          },
          include: {
            resource: true,
            customer: true,
            appliedOffer: true,
            addons: {
              include: {
                addonItem: true
              }
            }
          }
        })
      )
    );

    res.status(201).json({
      group: bookingGroup,
      bookings: createdBookings,
      totalAmount: groupTotalAmount,
      customer
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// GET /api/bookings/group/:groupId - Retrieve group booking details with all child bookings
router.get('/group/:groupId', async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const bookingGroup = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        customer: true,
        bookings: {
          include: {
            resource: true,
            appliedOffer: true,
            addons: {
              include: {
                addonItem: true
              }
            }
          },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!bookingGroup) {
      return res.status(404).json({ error: 'Group booking not found' });
    }

    res.json(bookingGroup);
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/group/:groupId/upload-payment - Upload combined payment screenshot for all activities in a group
router.post('/group/:groupId/upload-payment', async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const body = uploadPaymentSchema.parse(req.body);

    const bookingGroup = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId },
      include: { bookings: true }
    });

    if (!bookingGroup) {
      return res.status(404).json({ error: 'Group booking not found' });
    }

    if (bookingGroup.status === BookingStatus.CANCELLED) {
      return res.status(400).json({ error: 'This group booking has expired or been cancelled.' });
    }

    let base64Data = body.screenshotBase64;
    let ext = 'png';
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (match) {
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `grp_payment_${groupId}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const screenshotUrl = `/uploads/${fileName}`;

    // Update parent BookingGroup
    const updatedGroup = await (prisma as any).bookingGroup.update({
      where: { id: groupId },
      data: {
        paymentScreenshotUrl: screenshotUrl,
        paymentSubmittedAt: new Date(),
        status: BookingStatus.AWAITING_VERIFICATION,
        rejectionReason: null,
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid })
      }
    });

    // Cascade to all child bookings in the group
    await prisma.booking.updateMany({
      where: { bookingGroupId: groupId },
      data: {
        paymentScreenshotUrl: screenshotUrl,
        paymentSubmittedAt: new Date(),
        status: BookingStatus.AWAITING_VERIFICATION,
        rejectionReason: null,
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod })
      }
    });

    const fullGroup = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        customer: true,
        bookings: {
          include: { resource: true, appliedOffer: true }
        }
      }
    });

    res.json(fullGroup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid screenshot payload', details: error.errors });
    }
    next(error);
  }
});

// POST /api/bookings/group/:groupId/verify - Verify or reject all bookings in a group at once
const verifyGroupSchema = z.object({
  status: z.enum([BookingStatus.CONFIRMED, BookingStatus.REJECTED]),
  rejectionReason: z.string().optional(),
  amountPaid: z.number().optional()
});

router.post('/group/:groupId/verify', requireAdminAuth(), async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const body = verifyGroupSchema.parse(req.body);

    const bookingGroup = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId }
    });

    if (!bookingGroup) {
      return res.status(404).json({ error: 'Group booking not found' });
    }

    const verifiedAt = body.status === BookingStatus.CONFIRMED ? new Date() : null;

    // Update parent group
    const updatedGroup = await (prisma as any).bookingGroup.update({
      where: { id: groupId },
      data: {
        status: body.status,
        verifiedAt,
        rejectionReason: body.status === BookingStatus.REJECTED ? body.rejectionReason : null,
        ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid })
      }
    });

    // Update all child bookings
    await prisma.booking.updateMany({
      where: { bookingGroupId: groupId },
      data: {
        status: body.status,
        verifiedAt,
        rejectionReason: body.status === BookingStatus.REJECTED ? body.rejectionReason : null
      }
    });

    // If rejected, restore stock for all addons in the group
    if (body.status === BookingStatus.REJECTED) {
      const childBookings = await prisma.booking.findMany({
        where: { bookingGroupId: groupId },
        include: { addons: true }
      });
      for (const cb of childBookings) {
        if (cb.addons && cb.addons.length > 0) {
          for (const ba of cb.addons) {
            const item = await prisma.addonItem.findUnique({ where: { id: ba.addonItemId } });
            if (item && item.stock !== null && item.stock !== undefined) {
              await prisma.addonItem.update({
                where: { id: ba.addonItemId },
                data: { stock: item.stock + ba.quantity }
              });
            }
          }
        }
      }
    }

    if ((req as AuthenticatedAdminRequest).admin?.id) {
      createAuditLog(
        (req as AuthenticatedAdminRequest).admin!.id,
        body.status === BookingStatus.CONFIRMED ? 'VERIFY' : 'REJECT',
        'BOOKING_GROUP',
        groupId,
        {
          status: body.status,
          amountPaid: body.amountPaid,
          rejectionReason: body.rejectionReason,
        }
      );
    }

    const fullGroup = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        customer: true,
        bookings: {
          include: { resource: true, appliedOffer: true }
        }
      }
    });

    res.json(fullGroup);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid payload', details: error.errors });
    }
    next(error);
  }
});

// GET /api/bookings/group/:groupId/receipt-pdf - Branded Multi-Activity PDF receipt
router.get('/group/:groupId/receipt-pdf', requireAdminAuth(), async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await (prisma as any).bookingGroup.findUnique({
      where: { id: groupId },
      include: {
        customer: true,
        bookings: {
          include: {
            resource: true,
            appliedOffer: true,
            addons: {
              include: {
                addonItem: true
              }
            }
          },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!group || !group.bookings || group.bookings.length === 0) {
      return res.status(404).json({ error: 'Group booking not found or has no activities' });
    }

    const shortId = group.id.slice(-8).toUpperCase();
    const filename = `ZeroOne-Group-Receipt-${shortId}.pdf`;

    // Dynamic height calculation based on number of items (or A4/A5)
    const doc = new PDFDocument({
      size: 'A4',
      margin: 32,
      info: {
        Title: `Group Receipt #${shortId} - ZeroOne Cue & Play`,
        Author: 'ZeroOne Cue & Play',
        Subject: 'Group Booking Confirmation Receipt',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Colors
    const COLOR_DARK = '#111317';
    const COLOR_CARD = '#1a1d24';
    const COLOR_TEXT = '#f3f4f6';
    const COLOR_MUTED = '#9ca3af';
    const COLOR_ACCENT = '#c9a84c'; // Brass Gold
    const COLOR_EMERALD = '#10b981';
    const COLOR_BORDER = '#2d3340';

    // Page Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR_DARK);

    // Header Background Accent Stripe
    doc.rect(0, 0, doc.page.width, 6).fill(COLOR_ACCENT);

    let currentY = 28;

    // Logo check
    let logoLoaded = false;
    try {
      const theme = await prisma.themeSettings.findFirst({
        where: {
          target: 'WEBSITE',
          mode: 'LIGHT',
        },
      });
      const customLogo = theme?.logoUrlLight || theme?.logoUrlDark;
      if (customLogo) {
        const cleanPath = customLogo.replace(/^\//, '');
        const fullCustomLogoPath = path.join(process.cwd(), cleanPath);
        if (fs.existsSync(fullCustomLogoPath)) {
          doc.image(fullCustomLogoPath, 32, currentY, { width: 120 });
          logoLoaded = true;
        }
      }
    } catch {
      // Fallback
    }

    if (!logoLoaded) {
      const darkLogoPath = path.join(process.cwd(), '..', 'website', 'public', 'logo-dark.png');
      const standardLogoPath = path.join(process.cwd(), '..', 'website', 'public', 'logo.png');
      const logoPath = fs.existsSync(darkLogoPath) ? darkLogoPath : standardLogoPath;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 32, currentY, { width: 120 });
          logoLoaded = true;
        } catch {}
      }
    }

    if (!logoLoaded) {
      doc.fillColor(COLOR_ACCENT).fontSize(18).font('Helvetica-Bold').text('ZERO ONE', 32, currentY);
      doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica').text('CUE & PLAY', 32, currentY + 20);
    }

    // Receipt Badge
    doc.fillColor(COLOR_ACCENT).fontSize(15).font('Helvetica-Bold').text('GROUP BOOKING CONFIRMATION', 200, currentY + 2, {
      align: 'right',
      width: doc.page.width - 232,
    });
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(`GROUP #${shortId} (${group.bookings.length} ACTIVITIES)`, 200, currentY + 20, {
      align: 'right',
      width: doc.page.width - 232,
    });

    currentY += 50;
    doc.moveTo(32, currentY).lineTo(doc.page.width - 32, currentY).strokeColor(COLOR_BORDER).lineWidth(1).stroke();
    currentY += 14;

    // Customer & Group Overview Box
    const colWidth = (doc.page.width - 64 - 14) / 2;
    const cardHeight = 74;

    doc.roundedRect(32, currentY, colWidth, cardHeight, 6).fill(COLOR_CARD);
    doc.fillColor(COLOR_ACCENT).fontSize(8.5).font('Helvetica-Bold').text('CUSTOMER DETAILS', 44, currentY + 10);
    doc.fillColor(COLOR_TEXT).fontSize(12).font('Helvetica-Bold').text(group.customer.name, 44, currentY + 24, {
      width: colWidth - 24,
      ellipsis: true,
    });
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(`Phone: ${group.customer.phone}`, 44, currentY + 40);
    if (group.customer.email) {
      doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text(group.customer.email, 44, currentY + 54, {
        width: colWidth - 24,
        ellipsis: true,
      });
    }

    const rightColX = 32 + colWidth + 14;
    doc.roundedRect(rightColX, currentY, colWidth, cardHeight, 6).fill(COLOR_CARD);
    doc.fillColor(COLOR_ACCENT).fontSize(8.5).font('Helvetica-Bold').text('GROUP ORDER OVERVIEW', rightColX + 12, currentY + 10);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Status:', rightColX + 12, currentY + 26);
    const statusColor = group.status === BookingStatus.CONFIRMED || group.status === BookingStatus.COMPLETED ? COLOR_EMERALD : COLOR_ACCENT;
    doc.fillColor(statusColor).fontSize(9.5).font('Helvetica-Bold').text(group.status.replace(/_/g, ' '), rightColX + 55, currentY + 26);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Activities:', rightColX + 12, currentY + 42);
    doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold').text(`${group.bookings.length} Reserved Item(s)`, rightColX + 65, currentY + 42);

    const createdStr = new Date(group.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Booked on:', rightColX + 12, currentY + 56);
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica').text(createdStr, rightColX + 68, currentY + 56);

    currentY += cardHeight + 16;

    // Activities Table
    doc.fillColor(COLOR_ACCENT).fontSize(10).font('Helvetica-Bold').text('SCHEDULED ACTIVITIES & STATIONS', 32, currentY);
    currentY += 16;

    // Table Header
    doc.roundedRect(32, currentY, doc.page.width - 64, 24, 4).fill(COLOR_CARD);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('#', 42, currentY + 7);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('ACTIVITY / STATION', 65, currentY + 7);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('DATE & TIME', 220, currentY + 7);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('DURATION', 380, currentY + 7);
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica-Bold').text('AMOUNT', doc.page.width - 100, currentY + 7, { align: 'right', width: 55 });
    currentY += 28;

    // Table Rows
    group.bookings.forEach((b: any, idx: number) => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      const bDate = bStart.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      const bTime = `${bStart.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })} - ${bEnd.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      const durMins = Math.round((bEnd.getTime() - bStart.getTime()) / (1000 * 60));
      const durStr = durMins >= 60 ? `${(durMins / 60).toFixed(1).replace('.0', '')} hr` : `${durMins}m`;

      doc.roundedRect(32, currentY, doc.page.width - 64, 34, 4).fill(COLOR_CARD);
      doc.fillColor(COLOR_ACCENT).fontSize(9).font('Helvetica-Bold').text(`${idx + 1}`, 42, currentY + 11);
      doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(b.resource.name, 65, currentY + 6);
      doc.fillColor(COLOR_MUTED).fontSize(7.5).font('Helvetica').text(b.resource.type, 65, currentY + 19);

      doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica').text(`${bDate}, ${bTime}`, 220, currentY + 11);
      doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text(durStr, 380, currentY + 11);
      doc.fillColor(COLOR_EMERALD).fontSize(9.5).font('Helvetica-Bold').text(`₨${b.totalPrice.toLocaleString()}`, doc.page.width - 100, currentY + 11, { align: 'right', width: 55 });

      currentY += 38;
    });

    // Addons across all child bookings (if any)
    const allGroupAddons: Array<{ name: string; quantity: number; price: number }> = [];
    group.bookings.forEach((b: any) => {
      if (b.addons && b.addons.length > 0) {
        b.addons.forEach((ba: any) => {
          allGroupAddons.push({
            name: ba.addonItem?.name || 'Add-on Item',
            quantity: ba.quantity,
            price: ba.priceAtBooking * ba.quantity
          });
        });
      }
    });

    if (allGroupAddons.length > 0) {
      currentY += 4;
      doc.fillColor(COLOR_ACCENT).fontSize(10).font('Helvetica-Bold').text('CAFÉ & SNACK ADD-ONS', 32, currentY);
      currentY += 14;

      allGroupAddons.forEach((item) => {
        doc.roundedRect(32, currentY, doc.page.width - 64, 26, 4).fill(COLOR_CARD);
        doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold').text(`${item.name} × ${item.quantity}`, 44, currentY + 8);
        doc.fillColor(COLOR_EMERALD).fontSize(9).font('Helvetica-Bold').text(`₨${item.price.toLocaleString()}`, doc.page.width - 100, currentY + 8, { align: 'right', width: 55 });
        currentY += 30;
      });
    }

    currentY += 8;

    // Total Summary Box
    const totalBoxHeight = 56;
    doc.roundedRect(32, currentY, doc.page.width - 64, totalBoxHeight, 6).fill(COLOR_CARD);
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Payment Method:', 44, currentY + 14);
    const payMethod = group.paymentMethod ? group.paymentMethod.replace('ONLINE_', '').replace(/_/g, ' ') : 'ONLINE / PENDING';
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(payMethod, 140, currentY + 14);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Payment Status:', 44, currentY + 32);
    const isPaid = group.status === BookingStatus.CONFIRMED || group.status === BookingStatus.COMPLETED;
    doc.fillColor(isPaid ? COLOR_EMERALD : COLOR_ACCENT).fontSize(9.5).font('Helvetica-Bold').text(isPaid ? 'PAID & VERIFIED' : 'PENDING VERIFICATION', 140, currentY + 32);

    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text('TOTAL COMBINED AMOUNT', doc.page.width - 200, currentY + 12, { align: 'right', width: 155 });
    doc.fillColor(COLOR_EMERALD).fontSize(16).font('Helvetica-Bold').text(`PKR ₨${group.totalAmount.toLocaleString()}`, doc.page.width - 200, currentY + 26, { align: 'right', width: 155 });

    currentY += totalBoxHeight + 16;

    // Venue Notes
    const noteHeight = 44;
    doc.roundedRect(32, currentY, doc.page.width - 64, noteHeight, 6).strokeColor(COLOR_ACCENT).lineWidth(0.8).stroke();
    doc.fillColor(COLOR_ACCENT).fontSize(8.5).font('Helvetica-Bold').text('IMPORTANT GUEST INSTRUCTIONS:', 44, currentY + 8);
    doc.fillColor(COLOR_TEXT).fontSize(7.5).font('Helvetica').text(
      '• Please arrive at least 5 to 10 minutes prior to your first reserved activity slot.\n• Present this combined group booking slip or Group ID at the reception counter upon arrival.',
      44,
      currentY + 21,
      { lineGap: 2.5 }
    );

    currentY += noteHeight + 20;

    // Footer
    doc.moveTo(32, currentY).lineTo(doc.page.width - 32, currentY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    currentY += 8;

    doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold').text('ZeroOne Cue & Play — Premium Snooker, PS5 Gaming & Cinema Lounge', 32, currentY, {
      align: 'center',
      width: doc.page.width - 64,
    });

    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(
      'F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi  |  Phone: 0371-2160471  |  Open 24/7',
      32,
      currentY + 12,
      { align: 'center', width: doc.page.width - 64 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating group receipt PDF:', error);
    next(error);
  }
});


// GET /api/bookings/my-bookings - Get all bookings for the logged-in customer categorized into upcoming & past
router.get('/my-bookings', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    await autoCancelExpiredPendingPayments();
    await autoCompleteExpiredBookings();

    const customerId = req.customer!.customerId;

    const [customer, bookings] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          isRegistered: true,
          createdAt: true,
          _count: {
            select: { bookings: true }
          }
        }
      }),
      prisma.booking.findMany({
        where: { customerId },
        include: {
          resource: true,
          customer: true,
          appliedOffer: true
        },
        orderBy: { startTime: 'desc' }
      })
    ]);

    if (!customer) {
      return res.status(404).json({ error: 'Customer account not found' });
    }

    const now = new Date();
    const upcoming: typeof bookings = [];
    const past: typeof bookings = [];

    bookings.forEach((b) => {
      const endTime = new Date(b.endTime);
      const isFinished = b.status === BookingStatus.COMPLETED || b.status === BookingStatus.CANCELLED || endTime < now;
      if (isFinished) {
        past.push(b);
      } else {
        upcoming.push(b);
      }
    });

    res.json({
      customer,
      upcoming,
      past,
      total: bookings.length
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/cancel - Customer self-cancel booking
router.post('/:id/cancel', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Security check: Must belong to current customer
    if (booking.customerId !== req.customer!.customerId) {
      return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return res.status(400).json({ error: 'Cannot cancel a completed booking' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        rejectionReason: 'Cancelled by customer'
      },
      include: {
        resource: true,
        customer: true,
        addons: true
      }
    });

    // Restore stock if any addons were attached
    if (updated.addons && updated.addons.length > 0) {
      for (const ba of updated.addons) {
        const item = await prisma.addonItem.findUnique({ where: { id: ba.addonItemId } });
        if (item && item.stock !== null && item.stock !== undefined) {
          await prisma.addonItem.update({
            where: { id: ba.addonItemId },
            data: { stock: item.stock + ba.quantity }
          });
        }
      }
    }

    res.json({ message: 'Booking cancelled successfully', booking: updated });
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings/:id/reupload-payment - Re-upload payment after rejection or pending
router.post('/:id/reupload-payment', requireCustomerAuth, async (req: AuthenticatedCustomerRequest, res, next) => {
  try {
    const { id } = req.params;
    const body = uploadPaymentSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Security check: Must belong to current customer
    if (booking.customerId !== req.customer!.customerId) {
      return res.status(403).json({ error: 'Unauthorized to update this booking' });
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return res.status(400).json({ error: 'This booking has expired or been cancelled.' });
    }

    // Process Base64 image
    let base64Data = body.screenshotBase64;
    let ext = 'png';
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (match) {
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `reupload_${id}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const screenshotUrl = `/uploads/${fileName}`;

    // Reset status back to AWAITING_VERIFICATION and clear previous rejection
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        paymentScreenshotUrl: screenshotUrl,
        paymentSubmittedAt: new Date(),
        status: BookingStatus.AWAITING_VERIFICATION,
        rejectionReason: null,
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid })
      },
      include: {
        resource: true,
        customer: true
      }
    });

    res.json({ message: 'Screenshot re-uploaded successfully', booking: updatedBooking });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid screenshot payload', details: error.errors });
    }
    next(error);
  }
});

// GET /api/bookings/reminders-due - List confirmed bookings starting in the next time window (customizable minutes, default 0-60m)
router.get('/reminders-due', async (req, res, next) => {
  try {
    const { maxMinutes = '60', minMinutes = '0' } = req.query;
    const maxMins = parseInt(maxMinutes as string, 10) || 60;
    const minMins = parseInt(minMinutes as string, 10) || 0;

    const now = new Date();
    const minTime = new Date(now.getTime() + minMins * 60 * 1000);
    const maxTime = new Date(now.getTime() + maxMins * 60 * 1000);

    const remindersDue = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CONFIRMED,
        reminderSent: false,
        startTime: {
          gte: minTime,
          lte: maxTime
        }
      },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    res.json(remindersDue);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/reminders-history - List bookings where reminderSent is true (most recently updated/sent first)
router.get('/reminders-history', async (req, res, next) => {
  try {
    const { limit = '50' } = req.query;
    const take = Math.min(100, parseInt(limit as string, 10) || 50);

    const history = await prisma.booking.findMany({
      where: {
        reminderSent: true
      },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take
    });

    res.json(history);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings - List bookings with advanced filters & search
router.get('/', async (req, res, next) => {
  try {
    // Lazy evaluation fallback: Auto-cancel expired pending payments & auto-complete expired confirmed bookings
    await autoCancelExpiredPendingPayments();
    await autoCompleteExpiredBookings();

    const {
      date,
      dateFrom,
      dateTo,
      status,
      resourceType,
      bookingType,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    let startRange: Date | undefined;
    let endRange: Date | undefined;

    // 1. Exact Single Date Filter (Backward Compatibility)
    if (date && typeof date === 'string' && !dateFrom && !dateTo) {
      const [y, m, d] = date.split('-').map(Number);
      if (y && m && d) {
        startRange = new Date(Date.UTC(y, m - 1, d, -5, 0, 0, 0));
        endRange = new Date(Date.UTC(y, m - 1, d, 18, 59, 59, 999));
      } else {
        const targetDate = new Date(date);
        startRange = new Date(targetDate);
        startRange.setHours(0, 0, 0, 0);
        endRange = new Date(targetDate);
        endRange.setHours(23, 59, 59, 999);
      }
    }

    // 2. Date Range Filter (dateFrom to dateTo)
    if (dateFrom && typeof dateFrom === 'string') {
      const [y, m, d] = dateFrom.split('-').map(Number);
      startRange = y && m && d ? new Date(Date.UTC(y, m - 1, d, -5, 0, 0, 0)) : new Date(dateFrom);
    }

    if (dateTo && typeof dateTo === 'string') {
      const [y, m, d] = dateTo.split('-').map(Number);
      endRange = y && m && d ? new Date(Date.UTC(y, m - 1, d, 18, 59, 59, 999)) : new Date(dateTo);
    }

    // 3. Resource / Activity Filter (supports single value or comma-separated list)
    let resourceTypesList: ResourceType[] | undefined;
    if (resourceType && typeof resourceType === 'string') {
      const rawTypes = resourceType.split(',').map((t) => t.trim().toUpperCase());
      const validTypes = rawTypes.filter((t) =>
        Object.values(ResourceType).includes(t as ResourceType)
      ) as ResourceType[];
      if (validTypes.length > 0) {
        resourceTypesList = validTypes;
      }
    }

    // 4. Booking Type Filter (online / walkin)
    let isWalkInFilter: boolean | undefined;
    if (bookingType === 'online') {
      isWalkInFilter = false;
    } else if (bookingType === 'walkin') {
      isWalkInFilter = true;
    }

    // 5. Search Filter (Customer name or phone)
    const searchStr = typeof search === 'string' ? search.trim() : '';

    // 6. Sorting configuration
    let orderByClause: any = { createdAt: 'desc' };
    const orderDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    if (sortBy === 'amount') {
      orderByClause = { totalPrice: orderDirection };
    } else if (sortBy === 'customer') {
      orderByClause = { customer: { name: orderDirection } };
    } else if (sortBy === 'paymentSubmittedAt') {
      orderByClause = { paymentSubmittedAt: orderDirection };
    } else if (sortBy === 'date' || sortBy === 'startTime') {
      orderByClause = { startTime: orderDirection };
    } else if (sortBy === 'createdAt') {
      orderByClause = { createdAt: orderDirection };
    }

    const bookings = await prisma.booking.findMany({
      where: {
        ...(startRange || endRange
          ? {
              startTime: {
                ...(startRange && { gte: startRange }),
                ...(endRange && { lte: endRange })
              }
            }
          : {}),
        ...(status && typeof status === 'string' && {
          status: {
            in: status.split(',').map((s) => s.trim()) as BookingStatus[]
          }
        }),
        ...(resourceTypesList && {
          resource: {
            type: { in: resourceTypesList }
          }
        }),
        ...(isWalkInFilter !== undefined && { isWalkIn: isWalkInFilter }),
        ...(searchStr && {
          OR: [
            { customer: { name: { contains: searchStr } } },
            { customer: { phone: { contains: searchStr } } }
          ]
        })
      },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true,
        bookingGroup: true,
        addons: {
          include: {
            addonItem: true
          }
        }
      },
      orderBy: orderByClause
    });

    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/:id - Get single booking by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true,
        addons: {
          include: {
            addonItem: true
          }
        },
        bookingGroup: {
          include: {
            bookings: {
              include: {
                resource: true,
                addons: {
                  include: {
                    addonItem: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/bookings/:id - Update booking
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateBookingSchema.parse(req.body);

    const existingBooking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // If time is being changed, check for conflicts
    if (data.startTime || data.endTime) {
      const newStartTime = data.startTime ? new Date(data.startTime) : existingBooking.startTime;
      const newEndTime = data.endTime ? new Date(data.endTime) : existingBooking.endTime;

      if (newEndTime <= newStartTime) {
        return res.status(400).json({ error: 'End time must be after start time' });
      }

      const hasConflictingBooking = await hasConflict(
        existingBooking.resourceId,
        newStartTime,
        newEndTime,
        id
      );

      if (hasConflictingBooking) {
        return res.status(409).json({
          error: 'Time slot conflict',
          message: 'This resource is already booked for the requested time slot'
        });
      }

      // Recalculate price if time changed
      const newTotalPrice = await calculatePrice(existingBooking.resourceId, newStartTime, newEndTime);

      const booking = await prisma.booking.update({
        where: { id },
        data: {
          ...data,
          startTime: newStartTime,
          endTime: newEndTime,
          totalPrice: newTotalPrice
        },
        include: {
          resource: true,
          customer: true
        }
      });

      return res.json(booking);
    }

    // Just status update
    const booking = await prisma.booking.update({
      where: { id },
      data,
      include: {
        resource: true,
        customer: true,
        addons: true
      }
    });

    // If booking was cancelled or rejected, restore stock
    if ((data.status === BookingStatus.CANCELLED || data.status === BookingStatus.REJECTED) && booking.addons && booking.addons.length > 0) {
      for (const ba of booking.addons) {
        const item = await prisma.addonItem.findUnique({ where: { id: ba.addonItemId } });
        if (item && item.stock !== null && item.stock !== undefined) {
          await prisma.addonItem.update({
            where: { id: ba.addonItemId },
            data: { stock: item.stock + ba.quantity }
          });
        }
      }
    }

    // If status updated and booking is part of a group, sync parent group status if applicable
    if (data.status && existingBooking.bookingGroupId) {
      try {
        if (data.status === BookingStatus.CONFIRMED) {
          await (prisma as any).bookingGroup.update({
            where: { id: existingBooking.bookingGroupId },
            data: {
              status: BookingStatus.CONFIRMED,
              verifiedAt: new Date()
            }
          });
        } else if (data.status === BookingStatus.REJECTED) {
          await (prisma as any).bookingGroup.update({
            where: { id: existingBooking.bookingGroupId },
            data: {
              status: BookingStatus.REJECTED,
              rejectionReason: data.rejectionReason || null
            }
          });
        }
      } catch (err) {
        console.error('Failed to update group status on booking patch:', err);
      }
    }

    if ((req as any).admin?.id) {
      createAuditLog((req as any).admin.id, 'UPDATE', 'BOOKING', id, { ...data });
    }

    res.json(booking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    next(error);
  }
});

// POST /api/bookings/:id/upload-payment - Upload Payment Screenshot (Base64 or image data)
const uploadPaymentSchema = z.object({
  screenshotBase64: z.string().min(1, 'Screenshot data is required'),
  fileName: z.string().optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  amountPaid: z.number().optional()
});

router.post('/:id/upload-payment', async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = uploadPaymentSchema.parse(req.body);

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return res.status(400).json({ error: 'This booking has expired or been cancelled.' });
    }

    // Process Base64 image
    let base64Data = body.screenshotBase64;
    let ext = 'png';
    const match = base64Data.match(/^data:image\/(png|jpeg|jpg|webp);base64,/);
    if (match) {
      ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Check file size (5MB limit)
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
    }

    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `payment_${id}_${Date.now()}.${ext}`;
    const filePath = path.join(uploadsDir, fileName);
    fs.writeFileSync(filePath, buffer);

    const screenshotUrl = `/uploads/${fileName}`;

    // Update booking status to AWAITING_VERIFICATION
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        paymentScreenshotUrl: screenshotUrl,
        paymentSubmittedAt: new Date(),
        status: BookingStatus.AWAITING_VERIFICATION,
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid })
      },
      include: {
        resource: true,
        customer: true
      }
    });

    // If part of a group, sync parent BookingGroup
    if (booking.bookingGroupId) {
      try {
        await (prisma as any).bookingGroup.update({
          where: { id: booking.bookingGroupId },
          data: {
            paymentScreenshotUrl: screenshotUrl,
            paymentSubmittedAt: new Date(),
            status: BookingStatus.AWAITING_VERIFICATION,
            rejectionReason: null,
            ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
            ...(body.amountPaid !== undefined && { amountPaid: body.amountPaid })
          }
        });
        // Also sync sibling bookings in the group
        await prisma.booking.updateMany({
          where: { bookingGroupId: booking.bookingGroupId },
          data: {
            paymentScreenshotUrl: screenshotUrl,
            paymentSubmittedAt: new Date(),
            status: BookingStatus.AWAITING_VERIFICATION,
            rejectionReason: null,
            ...(body.paymentMethod && { paymentMethod: body.paymentMethod })
          }
        });
      } catch (err) {
        console.error('Failed to cascade group payment sync:', err);
      }
    }

    res.json(updatedBooking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid screenshot payload', details: error.errors });
    }
    next(error);
  }
});

// GET /api/bookings/:id/receipt-pdf (or /api/admin/bookings/:id/receipt-pdf) - Generate branded PDF receipt
router.get('/:id/receipt-pdf', requireAdminAuth(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        resource: true,
        customer: true,
        appliedOffer: true,
        addons: {
          include: {
            addonItem: true
          }
        }
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const shortId = booking.id.slice(-8).toUpperCase();
    const filename = `ZeroOne-Receipt-${shortId}.pdf`;

    // A5 dimensions in points: 419.53 x 595.28
    const doc = new PDFDocument({
      size: 'A5',
      margin: 28,
      info: {
        Title: `Receipt #${shortId} - ZeroOne Cue & Play`,
        Author: 'ZeroOne Cue & Play',
        Subject: 'Booking Confirmation Receipt',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Color Palette
    const COLOR_DARK = '#111317';
    const COLOR_CARD = '#1a1d24';
    const COLOR_TEXT = '#f3f4f6';
    const COLOR_MUTED = '#9ca3af';
    const COLOR_ACCENT = '#c9a84c'; // Brass Gold
    const COLOR_EMERALD = '#10b981';
    const COLOR_BORDER = '#2d3340';

    // Page Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR_DARK);

    // Header Background Accent Stripe
    doc.rect(0, 0, doc.page.width, 6).fill(COLOR_ACCENT);

    // Header Brand Section
    let currentY = 24;

    // Check if dynamic light logo or fallback logo exists
    let logoLoaded = false;
    try {
      // Look up theme settings in DB for light mode logo
      const theme = await prisma.themeSettings.findFirst({
        where: {
          target: 'WEBSITE',
          mode: 'LIGHT',
        },
      });
      const customLogo = theme?.logoUrlLight || theme?.logoUrlDark;
      if (customLogo) {
        const cleanPath = customLogo.replace(/^\//, '');
        const fullCustomLogoPath = path.join(process.cwd(), cleanPath);
        if (fs.existsSync(fullCustomLogoPath)) {
          doc.image(fullCustomLogoPath, 28, currentY, { width: 110 });
          logoLoaded = true;
        }
      }
    } catch {
      // Fallback to static asset check
    }

    if (!logoLoaded) {
      const darkLogoPath = path.join(process.cwd(), '..', 'website', 'public', 'logo-dark.png');
      const standardLogoPath = path.join(process.cwd(), '..', 'website', 'public', 'logo.png');
      const logoPath = fs.existsSync(darkLogoPath) ? darkLogoPath : standardLogoPath;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, 28, currentY, { width: 110 });
          logoLoaded = true;
        } catch {
          // ignore
        }
      }
    }

    if (!logoLoaded) {
      doc.fillColor(COLOR_ACCENT).fontSize(16).font('Helvetica-Bold').text('ZERO ONE', 28, currentY);
      doc.fillColor(COLOR_TEXT).fontSize(10).font('Helvetica').text('CUE & PLAY', 28, currentY + 18);
    }

    // Receipt Badge (Right Aligned)
    doc.fillColor(COLOR_ACCENT).fontSize(14).font('Helvetica-Bold').text('BOOKING CONFIRMATION', 200, currentY + 2, {
      align: 'right',
      width: doc.page.width - 228,
    });
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(`SLIP #${shortId}`, 200, currentY + 20, {
      align: 'right',
      width: doc.page.width - 228,
    });

    currentY += 46;

    // Divider
    doc.moveTo(28, currentY).lineTo(doc.page.width - 28, currentY).strokeColor(COLOR_BORDER).lineWidth(1).stroke();
    currentY += 12;

    // 1. Customer & Status Section (Two Columns)
    const colWidth = (doc.page.width - 56 - 12) / 2;
    const cardHeight = 72;

    // Left Box: Customer Info
    doc.roundedRect(28, currentY, colWidth, cardHeight, 6).fill(COLOR_CARD);
    doc.fillColor(COLOR_ACCENT).fontSize(8).font('Helvetica-Bold').text('CUSTOMER DETAILS', 38, currentY + 10);
    doc.fillColor(COLOR_TEXT).fontSize(11).font('Helvetica-Bold').text(booking.customer.name, 38, currentY + 23, {
      width: colWidth - 20,
      lineBreak: false,
      ellipsis: true,
    });
    doc.fillColor(COLOR_MUTED).fontSize(9).font('Helvetica').text(`Phone: ${booking.customer.phone}`, 38, currentY + 38);
    if (booking.customer.email) {
      doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text(booking.customer.email, 38, currentY + 52, {
        width: colWidth - 20,
        ellipsis: true,
      });
    }

    // Right Box: Booking ID & Status
    const rightColX = 28 + colWidth + 12;
    doc.roundedRect(rightColX, currentY, colWidth, cardHeight, 6).fill(COLOR_CARD);
    doc.fillColor(COLOR_ACCENT).fontSize(8).font('Helvetica-Bold').text('BOOKING INFORMATION', rightColX + 10, currentY + 10);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Status:', rightColX + 10, currentY + 25);
    const statusColor = booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED ? COLOR_EMERALD : COLOR_ACCENT;
    doc.fillColor(statusColor).fontSize(9).font('Helvetica-Bold').text(booking.status.replace(/_/g, ' '), rightColX + 50, currentY + 25);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Type:', rightColX + 10, currentY + 40);
    doc.fillColor(COLOR_TEXT).fontSize(9).font('Helvetica-Bold').text(booking.isWalkIn ? 'Walk-in Counter' : 'Online Website', rightColX + 50, currentY + 40);

    const createdStr = new Date(booking.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Booked on:', rightColX + 10, currentY + 54);
    doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica').text(createdStr, rightColX + 60, currentY + 54);

    currentY += cardHeight + 14;

    // 2. Session & Schedule Section
    const sessionHeight = 118;
    doc.roundedRect(28, currentY, doc.page.width - 56, sessionHeight, 6).fill(COLOR_CARD);

    doc.fillColor(COLOR_ACCENT).fontSize(9).font('Helvetica-Bold').text('SESSION & STATION DETAILS', 38, currentY + 10);
    doc.moveTo(38, currentY + 24).lineTo(doc.page.width - 38, currentY + 24).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const dateFormatted = start.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeFormatted = `${start.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })} - ${end.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    const durationFormatted = durationMinutes >= 60 ? `${(durationMinutes / 60).toFixed(1).replace('.0', '')} hr (${durationMinutes} mins)` : `${durationMinutes} mins`;

    // Row 1: Activity & Station
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Activity / Category:', 38, currentY + 34);
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(booking.resource.type, 130, currentY + 34);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Station / Bay:', 220, currentY + 34);
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(booking.resource.name, 285, currentY + 34, {
      width: doc.page.width - 325,
      ellipsis: true,
    });

    // Row 2: Date & Duration
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Scheduled Date:', 38, currentY + 56);
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(dateFormatted, 130, currentY + 56);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Duration:', 220, currentY + 56);
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(durationFormatted, 285, currentY + 56);

    // Row 3: Time Slot Highlight
    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Reserved Time:', 38, currentY + 78);
    doc.fillColor(COLOR_ACCENT).fontSize(10.5).font('Helvetica-Bold').text(timeFormatted, 130, currentY + 77);

    // Row 4: Offer applied (if any)
    if (booking.appliedOffer || (booking.discountAmount && booking.discountAmount > 0)) {
      doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Special Offer:', 38, currentY + 98);
      const offerTitle = booking.appliedOffer?.title || 'Promo Discount';
      doc.fillColor(COLOR_EMERALD).fontSize(8.5).font('Helvetica-Bold').text(`${offerTitle} (-₨${(booking.discountAmount || 0).toLocaleString()})`, 130, currentY + 98);
    }

    currentY += sessionHeight + 14;

    // 2.5 Add-ons Section (if any purchased)
    if (booking.addons && booking.addons.length > 0) {
      const addonsHeight = 26 + booking.addons.length * 18;
      doc.roundedRect(28, currentY, doc.page.width - 56, addonsHeight, 6).fill(COLOR_CARD);
      doc.fillColor(COLOR_ACCENT).fontSize(9).font('Helvetica-Bold').text('CAFÉ & SNACK ADD-ONS', 38, currentY + 8);
      doc.moveTo(38, currentY + 20).lineTo(doc.page.width - 38, currentY + 20).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

      let addonY = currentY + 24;
      booking.addons.forEach((ba) => {
        doc.fillColor(COLOR_TEXT).fontSize(8.5).font('Helvetica-Bold').text(`${ba.addonItem?.name || 'Add-on'} × ${ba.quantity}`, 38, addonY);
        doc.fillColor(COLOR_EMERALD).fontSize(8.5).font('Helvetica-Bold').text(`₨${(ba.priceAtBooking * ba.quantity).toLocaleString()}`, doc.page.width - 120, addonY, {
          align: 'right',
          width: 80
        });
        addonY += 18;
      });

      currentY += addonsHeight + 14;
    }

    // 3. Payment & Pricing Section
    const paymentHeight = 82;
    doc.roundedRect(28, currentY, doc.page.width - 56, paymentHeight, 6).fill(COLOR_CARD);

    doc.fillColor(COLOR_ACCENT).fontSize(9).font('Helvetica-Bold').text('PAYMENT SUMMARY', 38, currentY + 10);
    doc.moveTo(38, currentY + 24).lineTo(doc.page.width - 38, currentY + 24).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();

    const paymentMethodLabel = booking.paymentMethod ? booking.paymentMethod.replace('ONLINE_', '').replace(/_/g, ' ') : (booking.isWalkIn ? 'CASH' : 'PENDING');

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Payment Method:', 38, currentY + 35);
    doc.fillColor(COLOR_TEXT).fontSize(9.5).font('Helvetica-Bold').text(paymentMethodLabel, 130, currentY + 35);

    doc.fillColor(COLOR_MUTED).fontSize(8.5).font('Helvetica').text('Payment Status:', 38, currentY + 53);
    const isPaid = booking.isWalkIn || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.COMPLETED;
    doc.fillColor(isPaid ? COLOR_EMERALD : COLOR_ACCENT).fontSize(9.5).font('Helvetica-Bold').text(isPaid ? 'PAID & VERIFIED' : 'PENDING PAYMENT', 130, currentY + 53);

    // Big Total Amount on Right
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text('TOTAL AMOUNT PAID', doc.page.width - 180, currentY + 30, {
      align: 'right',
      width: 140,
    });
    doc.fillColor(COLOR_EMERALD).fontSize(16).font('Helvetica-Bold').text(`PKR ₨${booking.totalPrice.toLocaleString()}`, doc.page.width - 180, currentY + 44, {
      align: 'right',
      width: 140,
    });

    currentY += paymentHeight + 16;

    // 4. Instructions & Venue Rules Box
    const noteHeight = 44;
    doc.roundedRect(28, currentY, doc.page.width - 56, noteHeight, 6).strokeColor(COLOR_ACCENT).lineWidth(0.8).stroke();
    doc.fillColor(COLOR_ACCENT).fontSize(8.5).font('Helvetica-Bold').text('IMPORTANT GUEST INSTRUCTIONS:', 38, currentY + 8);
    doc.fillColor(COLOR_TEXT).fontSize(7.5).font('Helvetica').text(
      '• Please arrive at least 5 to 10 minutes prior to your reserved slot.\n• Please show this confirmation slip or booking ID at the reception desk.',
      38,
      currentY + 21,
      { lineGap: 2.5 }
    );

    currentY += noteHeight + 16;

    // 5. Footer Section
    doc.moveTo(28, currentY).lineTo(doc.page.width - 28, currentY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    currentY += 8;

    doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold').text('ZeroOne Cue & Play — Premium Snooker, PS5 Gaming & Cinema Lounge', 28, currentY, {
      align: 'center',
      width: doc.page.width - 56,
    });

    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(
      'F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi  |  Phone: 0371-2160471  |  Open 24/7',
      28,
      currentY + 12,
      { align: 'center', width: doc.page.width - 56 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    next(error);
  }
});

export { router as bookingsRouter };

