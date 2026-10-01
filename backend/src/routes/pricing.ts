import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { PricingUnit, AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

const updatePricingSchema = z.object({
  basePrice: z.number({ invalid_type_error: 'Base price must be a number' })
    .min(0, { message: 'Base price cannot be negative' })
    .optional(),
  pricingUnit: z.nativeEnum(PricingUnit, {
    errorMap: () => ({ message: 'Pricing unit must be either PER_HOUR or PER_MINUTE' })
  }).optional(),
  halfHourPrice: z.number().int().min(0).nullable().optional(),
  fullHourPrice: z.number().int().min(0).nullable().optional(),
}).refine(data => data.basePrice !== undefined || data.pricingUnit !== undefined || data.halfHourPrice !== undefined || data.fullHourPrice !== undefined, {
  message: 'At least one field (basePrice, pricingUnit, halfHourPrice, or fullHourPrice) must be provided'
});

// GET /api/pricing - Get all activities pricing
router.get('/', async (req, res, next) => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { name: 'asc' }
    });

    res.json(activities);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/pricing/:id - Update activity base price and/or pricing unit (Super Admin & Manager only)
router.patch('/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updatePricingSchema.parse(req.body);

    const existingActivity = await prisma.activity.findUnique({
      where: { id }
    });

    if (!existingActivity) {
      return res.status(404).json({
        error: 'Activity not found',
        message: `No activity found with ID ${id}`
      });
    }

    const updatedActivity = await prisma.activity.update({
      where: { id },
      data: {
        ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
        ...(data.pricingUnit !== undefined && { pricingUnit: data.pricingUnit }),
        ...(data.halfHourPrice !== undefined && { halfHourPrice: data.halfHourPrice }),
        ...(data.fullHourPrice !== undefined && { fullHourPrice: data.fullHourPrice })
      }
    });

    res.json(updatedActivity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors
      });
    }
    next(error);
  }
});

export { router as pricingRouter };


