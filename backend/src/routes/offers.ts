import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { DiscountType, ApplicableTo, AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

const createOfferSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive('Discount value must be positive'),
  applicableTo: z.nativeEnum(ApplicableTo).default(ApplicableTo.ALL_ACTIVITIES),
  activityId: z.string().optional().nullable(),
  validFrom: z.string().transform(str => new Date(str)),
  validUntil: z.string().transform(str => new Date(str)),
  isActive: z.boolean().default(true),
  isVisibleOnWebsite: z.boolean().default(true),
  minDuration: z.number().int().positive().optional().nullable(),
  promoCode: z.string().optional().nullable(),
  bannerImageUrl: z.string().optional().nullable(),
});

const updateOfferSchema = createOfferSchema.partial();

// GET /api/offers - List all offers (Admin / query filter)
router.get('/', requireAdminAuth(['SUPER_ADMIN', 'MANAGER']), async (req, res, next) => {
  try {
    const { activeOnly, promoCode, visibleOnly } = req.query;
    const now = new Date();

    const where: any = {};
    if (activeOnly === 'true') {
      where.isActive = true;
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    }
    if (visibleOnly === 'true') {
      where.isVisibleOnWebsite = true;
    }
    if (promoCode && typeof promoCode === 'string') {
      where.promoCode = { equals: promoCode.trim().toUpperCase() };
      where.isActive = true;
      where.validFrom = { lte: now };
      where.validUntil = { gte: now };
    }

    const offers = await (prisma as any).offer.findMany({
      where,
      include: {
        activity: true,
        _count: {
          select: { bookings: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(offers);
  } catch (error) {
    next(error);
  }
});

// GET /api/offers/active - List all currently active public deals (Shown on Website)
router.get('/active', async (req, res, next) => {
  try {
    const now = new Date();
    const offers = await (prisma as any).offer.findMany({
      where: {
        isActive: true,
        isVisibleOnWebsite: true,
        validFrom: { lte: now },
        validUntil: { gte: now }
      },
      include: {
        activity: true
      },
      orderBy: { validUntil: 'asc' }
    });

    res.json(offers);
  } catch (error) {
    next(error);
  }
});

// POST /api/offers/validate-code - Validate a promo code
router.post('/validate-code', async (req, res, next) => {
  try {
    const { promoCode, activityId, durationMinutes } = req.body;
    if (!promoCode) {
      return res.status(400).json({ error: 'Promo code is required' });
    }

    const now = new Date();
    const offer = await (prisma as any).offer.findFirst({
      where: {
        promoCode: { equals: promoCode.trim().toUpperCase() },
        isActive: true,
        validFrom: { lte: now },
        validUntil: { gte: now }
      },
      include: {
        activity: true
      }
    });

    if (!offer) {
      return res.status(404).json({ valid: false, error: 'Invalid or expired promo code' });
    }

    if (offer.applicableTo === ApplicableTo.SPECIFIC_ACTIVITY && offer.activityId && activityId && offer.activityId !== activityId) {
      return res.status(400).json({ valid: false, error: `This promo code is only valid for ${offer.activity?.name || 'a specific activity'}` });
    }

    if (offer.minDuration && durationMinutes && durationMinutes < offer.minDuration) {
      return res.status(400).json({ valid: false, error: `Minimum booking duration of ${offer.minDuration} minutes required for this deal` });
    }

    res.json({
      valid: true,
      offer
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/offers - Create new offer (Super Admin & Manager only)
router.post('/', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const validatedData = createOfferSchema.parse(req.body);

    if (validatedData.promoCode) {
      validatedData.promoCode = validatedData.promoCode.trim().toUpperCase();
    }

    const offer = await (prisma as any).offer.create({
      data: validatedData,
      include: {
        activity: true
      }
    });

    res.status(201).json(offer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid offer data', details: error.errors });
    }
    next(error);
  }
});

// PATCH /api/offers/:id - Update offer (Super Admin & Manager only)
router.patch('/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const validatedData = updateOfferSchema.parse(req.body);

    if (validatedData.promoCode) {
      validatedData.promoCode = validatedData.promoCode.trim().toUpperCase();
    }

    const offer = await (prisma as any).offer.update({
      where: { id },
      data: validatedData,
      include: {
        activity: true
      }
    });

    res.json(offer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid offer data', details: error.errors });
    }
    next(error);
  }
});

// PATCH /api/offers/:id/toggle - Toggle active status (Super Admin & Manager only)
router.patch('/:id/toggle', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).offer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = await (prisma as any).offer.update({
      where: { id },
      data: { isActive: !existing.isActive }
    });

    res.json(offer);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/offers/:id/toggle-visibility - Toggle website visibility (Super Admin & Manager only)
router.patch('/:id/toggle-visibility', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).offer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = await (prisma as any).offer.update({
      where: { id },
      data: { isVisibleOnWebsite: !existing.isVisibleOnWebsite }
    });

    res.json(offer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/offers/:id - Delete offer (Super Admin & Manager only)
router.delete('/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;
    await (prisma as any).offer.delete({
      where: { id }
    });

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as offersRouter };
