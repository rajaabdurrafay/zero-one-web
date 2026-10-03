import { decodeImage, deleteLocalUpload } from '../utils/uploads';
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

const createGallerySchema = z.object({
  imageBase64: z.string().optional(),
  imageUrl: z.string().optional(),
  caption: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateGallerySchema = z.object({
  caption: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/gallery (Public - only active images)
router.get('/', async (req: Request, res: Response) => {
  try {
    const images = await prisma.galleryImage.findMany({
      where: { isActive: true },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(images);
  } catch (error) {
    console.error('Failed to get public gallery images:', error);
    res.status(500).json({ error: 'Failed to retrieve gallery' });
  }
});

// GET /api/gallery/admin (Admin - all images)
router.get('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const images = await prisma.galleryImage.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(images);
  } catch (error) {
    console.error('Failed to get admin gallery images:', error);
    res.status(500).json({ error: 'Failed to retrieve gallery' });
  }
});

// POST /api/gallery/admin (Admin - add new image)
router.post('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const validatedData = createGallerySchema.parse(req.body);
    let finalImageUrl = validatedData.imageUrl || '';

    // If Base64 image is passed, save it to disk
    if (validatedData.imageBase64) {
      const uploadsDir = path.join(process.cwd(), 'uploads', 'gallery');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const { buffer, extension } = decodeImage(validatedData.imageBase64);

      const uniqueName = `gallery_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
      const filePath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
      finalImageUrl = `/uploads/gallery/${uniqueName}`;
    }

    if (!finalImageUrl) {
      return res.status(400).json({ error: 'Image URL or imageBase64 is required' });
    }

    const image = await prisma.galleryImage.create({
      data: {
        imageUrl: finalImageUrl,
        caption: validatedData.caption || null,
        category: validatedData.category || null,
        displayOrder: validatedData.displayOrder,
        isActive: validatedData.isActive,
      }
    });

    res.status(201).json(image);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to create gallery image:', error);
    res.status(500).json({ error: 'Failed to create gallery image' });
  }
});

// PATCH /api/gallery/admin/:id (Admin - update)
router.patch('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateGallerySchema.parse(req.body);

    const updated = await prisma.galleryImage.update({
      where: { id },
      data: validatedData,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update gallery image:', error);
    res.status(500).json({ error: 'Failed to update gallery image' });
  }
});

// DELETE /api/gallery/admin/:id (Admin - delete)
router.delete('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const image = await prisma.galleryImage.findUnique({ where: { id } });

    if (!image) {
      return res.status(404).json({ error: 'Gallery image not found' });
    }

    deleteLocalUpload(image.imageUrl, 'gallery');

    await prisma.galleryImage.delete({ where: { id } });
    res.json({ message: 'Gallery image deleted successfully' });
  } catch (error) {
    console.error('Failed to delete gallery image:', error);
    res.status(500).json({ error: 'Failed to delete gallery image' });
  }
});

export { router as galleryRouter };
