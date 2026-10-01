import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

const createAddonSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional().nullable(),
  price: z.number().min(0, 'Price must be 0 or higher'),
  category: z.string().optional().default('Snacks'),
  stock: z.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean().optional().default(true),
  imageUrl: z.string().optional().nullable()
});

const updateAddonSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  description: z.string().optional().nullable(),
  price: z.number().min(0, 'Price must be 0 or higher').optional(),
  category: z.string().optional(),
  stock: z.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean().optional(),
  imageUrl: z.string().optional().nullable()
});

// 1. GET /api/addons -> Public / Customer list of available items
router.get('/', async (req, res, next) => {
  try {
    const { all } = req.query;
    // If all=true and authenticated, admin can see unavailable items too
    const whereClause = all === 'true' ? {} : { isAvailable: true };

    const addons = await prisma.addonItem.findMany({
      where: whereClause,
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    res.json(addons);
  } catch (error) {
    next(error);
  }
});

// 2. GET /api/addons/top -> Analytics for top purchased addons
router.get('/top', async (req, res, next) => {
  try {
    const items = await prisma.addonItem.findMany({
      include: {
        bookingAddons: {
          include: {
            booking: {
              select: {
                status: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    const stats = items.map((item: any) => {
      const validOrders = item.bookingAddons.filter(
        (ba: any) => ba.booking.status === 'CONFIRMED' || ba.booking.status === 'COMPLETED'
      );
      const totalQuantitySold = validOrders.reduce((sum: number, ba: any) => sum + ba.quantity, 0);
      const totalRevenueGenerated = validOrders.reduce((sum: number, ba: any) => sum + ba.quantity * ba.priceAtBooking, 0);

      return {
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        stock: item.stock,
        isAvailable: item.isAvailable,
        totalQuantitySold,
        totalRevenueGenerated
      };
    }).sort((a: any, b: any) => b.totalQuantitySold - a.totalQuantitySold);

    const totalAddonRevenue = stats.reduce((sum: number, s: any) => sum + s.totalRevenueGenerated, 0);
    const totalAddonUnits = stats.reduce((sum: number, s: any) => sum + s.totalQuantitySold, 0);

    res.json({
      totalAddonRevenue,
      totalAddonUnits,
      topAddons: stats
    });
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/addons/:id -> Single addon
router.get('/:id', async (req, res, next) => {
  try {
    const addon = await prisma.addonItem.findUnique({
      where: { id: req.params.id }
    });

    if (!addon) {
      return res.status(404).json({ error: 'Addon item not found' });
    }

    res.json(addon);
  } catch (error) {
    next(error);
  }
});

// 4. POST /api/addons -> Create new addon (Admin only)
router.post('/', requireAdminAuth(), async (req, res, next) => {
  try {
    const data = createAddonSchema.parse(req.body);
    const addon = await prisma.addonItem.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        category: data.category || 'Snacks',
        stock: data.stock !== undefined ? data.stock : null,
        isAvailable: data.isAvailable ?? true,
        imageUrl: data.imageUrl
      }
    });

    res.status(201).json(addon);
  } catch (error) {
    next(error);
  }
});

// 5. PATCH /api/addons/:id -> Update addon (Admin only)
router.patch('/:id', requireAdminAuth(), async (req, res, next) => {
  try {
    const data = updateAddonSchema.parse(req.body);
    const addon = await prisma.addonItem.update({
      where: { id: req.params.id },
      data
    });

    res.json(addon);
  } catch (error) {
    next(error);
  }
});

// 6. DELETE /api/addons/:id -> Delete addon (Admin only)
router.delete('/:id', requireAdminAuth(), async (req, res, next) => {
  try {
    await prisma.addonItem.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Addon item deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export { router as addonsRouter };
export default router;
