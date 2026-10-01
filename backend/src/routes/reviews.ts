import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

const publicSubmitReviewSchema = z.object({
  customerName: z.string().min(2, 'Name must be at least 2 characters'),
  customerAvatarUrl: z.string().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(5, 'Review text must be at least 5 characters'),
});

const adminCreateReviewSchema = z.object({
  customerName: z.string().min(2),
  customerAvatarUrl: z.string().nullable().optional(),
  avatarBase64: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().min(3),
  isApproved: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
});

const adminUpdateReviewSchema = z.object({
  customerName: z.string().min(2).optional(),
  customerAvatarUrl: z.string().nullable().optional(),
  avatarBase64: z.string().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reviewText: z.string().min(3).optional(),
  isApproved: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

// GET /api/reviews (Public - Only approved reviews + rating statistics)
router.get('/', async (req: Request, res: Response) => {
  try {
    const featuredOnly = req.query.featured === 'true';

    const whereClause: any = { isApproved: true };
    if (featuredOnly) {
      whereClause.isFeatured = true;
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    // Calculate summary statistics over ALL approved reviews
    const allApproved = await prisma.review.findMany({
      where: { isApproved: true },
      select: { rating: true },
    });

    const totalCount = allApproved.length;
    const averageRating =
      totalCount > 0
        ? Number((allApproved.reduce((acc, curr) => acc + curr.rating, 0) / totalCount).toFixed(1))
        : 5.0;

    res.json({
      reviews,
      stats: {
        totalReviews: totalCount,
        averageRating,
      },
    });
  } catch (error) {
    console.error('Failed to get public reviews:', error);
    res.status(500).json({ error: 'Failed to retrieve reviews' });
  }
});

// POST /api/reviews (Public submission - requires approval)
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = publicSubmitReviewSchema.parse(req.body);

    const review = await prisma.review.create({
      data: {
        customerName: validatedData.customerName,
        customerAvatarUrl: validatedData.customerAvatarUrl || null,
        rating: validatedData.rating,
        reviewText: validatedData.reviewText,
        isApproved: false, // Default to pending approval
        isFeatured: false,
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully and is pending approval.',
      review,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to submit public review:', error);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// GET /api/reviews/admin (Admin - all reviews, filterable by status)
router.get('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER, AdminRole.RECEPTIONIST]), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string; // 'pending' | 'approved' | 'all'

    const whereClause: any = {};
    if (status === 'pending') {
      whereClause.isApproved = false;
    } else if (status === 'approved') {
      whereClause.isApproved = true;
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    res.json(reviews);
  } catch (error) {
    console.error('Failed to get admin reviews:', error);
    res.status(500).json({ error: 'Failed to retrieve reviews' });
  }
});

// POST /api/reviews/admin (Admin - manually add review)
router.post('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const validatedData = adminCreateReviewSchema.parse(req.body);
    let finalAvatarUrl = validatedData.customerAvatarUrl || null;

    if (validatedData.avatarBase64) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'reviews');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const matches = validatedData.avatarBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let extension = 'png';

      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else if (mime.includes('webp')) extension = 'webp';
        else if (mime.includes('gif')) extension = 'gif';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(validatedData.avatarBase64, 'base64');
      }

      const uniqueName = `review_avatar_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
      const filePath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
      finalAvatarUrl = `/uploads/reviews/${uniqueName}`;
    }

    const review = await prisma.review.create({
      data: {
        customerName: validatedData.customerName,
        customerAvatarUrl: finalAvatarUrl,
        rating: validatedData.rating,
        reviewText: validatedData.reviewText,
        isApproved: validatedData.isApproved ?? true,
        isFeatured: validatedData.isFeatured ?? false,
      },
    });

    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to manually create review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// PATCH /api/reviews/admin/:id (Admin - approve/reject/feature)
router.patch('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = adminUpdateReviewSchema.parse(req.body);

    const updatePayload: any = { ...validatedData };
    delete updatePayload.avatarBase64;

    if (validatedData.avatarBase64) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'reviews');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const matches = validatedData.avatarBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let extension = 'png';

      if (matches && matches.length === 3) {
        const mime = matches[1];
        if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else if (mime.includes('webp')) extension = 'webp';
        else if (mime.includes('gif')) extension = 'gif';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(validatedData.avatarBase64, 'base64');
      }

      const uniqueName = `review_avatar_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
      const filePath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
      updatePayload.customerAvatarUrl = `/uploads/reviews/${uniqueName}`;
    }

    const updated = await prisma.review.update({
      where: { id },
      data: updatePayload,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// DELETE /api/reviews/admin/:id (Admin - delete review)
router.delete('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.customerAvatarUrl?.startsWith('/uploads/reviews/')) {
      const relativePath = review.customerAvatarUrl.replace('/uploads/reviews/', '');
      const filePath = path.join(process.cwd(), 'uploads', 'reviews', relativePath);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete physical avatar file:', e);
        }
      }
    }

    await prisma.review.delete({ where: { id } });
    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Failed to delete review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export { router as reviewsRouter };
