import { decodeImage } from '../utils/uploads';
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

const createReelSchema = z.object({
  platform: z.string().optional().default('INSTAGRAM'),
  url: z.string().url('A valid URL is required').refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL'),
  thumbnailBase64: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  caption: z.string().nullable().optional(),
  displayOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const updateReelSchema = z.object({
  platform: z.string().optional(),
  url: z.string().url().refine(value => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL').optional(),
  thumbnailBase64: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  caption: z.string().nullable().optional(),
  displayOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// Auto fetch/resolve thumbnail if not provided
function resolveThumbnailUrl(url: string, platform: string): string {
  if (!url) return '';

  // YouTube - HD Thumbnails still work reliably
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const ytMatch = url.match(/(?:shorts\/|v=|v\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) {
      return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
  }

  // Instagram and TikTok direct thumbnail fetching blocks due to CORS/API restrictions
  // So we will return empty string to let the frontend generate a stylish CSS fallback
  return '';
}

// Helper for saving base64 thumbnail
function saveBase64Thumbnail(base64Data: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads', 'reels');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const { buffer, extension: ext } = decodeImage(base64Data);

  const fileName = `reel-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/reels/${fileName}`;
}

// GET /api/reels (Public - only active reels, optional ?limit=N)
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
    const reels = await prisma.socialReel.findMany({
      where: { isActive: true },
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      ...(limit ? { take: limit } : {}),
    });
    res.json(reels);
  } catch (error) {
    console.error('Failed to get public reels:', error);
    res.status(500).json({ error: 'Failed to retrieve reels' });
  }
});

// GET /api/reels/admin (Admin - all reels)
router.get('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const reels = await prisma.socialReel.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    res.json(reels);
  } catch (error) {
    console.error('Failed to get admin reels:', error);
    res.status(500).json({ error: 'Failed to retrieve reels' });
  }
});

// POST /api/reels/admin (Admin - add new reel)
router.post('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const validated = createReelSchema.parse(req.body);

    let finalThumbnailUrl = validated.thumbnailUrl || '';
    if (validated.thumbnailBase64) {
      finalThumbnailUrl = saveBase64Thumbnail(validated.thumbnailBase64);
    }

    if (!finalThumbnailUrl) {
      finalThumbnailUrl = resolveThumbnailUrl(validated.url, validated.platform);
    }

    const reel = await prisma.socialReel.create({
      data: {
        platform: validated.platform || 'INSTAGRAM',
        url: validated.url,
        thumbnailUrl: finalThumbnailUrl,
        caption: validated.caption || null,
        displayOrder: validated.displayOrder ?? 0,
        isActive: validated.isActive ?? true,
      }
    });

    res.status(201).json(reel);
  } catch (error: any) {
    console.error('Failed to add reel:', error);
    res.status(400).json({ error: error instanceof z.ZodError ? 'Invalid reel payload' : 'Could not save reel' });
  }
});

// PATCH /api/reels/admin/:id (Admin - update reel)
router.patch('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validated = updateReelSchema.parse(req.body);

    const updateData: any = { ...validated };
    delete updateData.thumbnailBase64;

    if (validated.thumbnailBase64) {
      updateData.thumbnailUrl = saveBase64Thumbnail(validated.thumbnailBase64);
    } else if (!validated.thumbnailUrl && validated.url) {
      // If URL changed and no thumbnail was uploaded, refresh auto thumbnail
      const existing = await prisma.socialReel.findUnique({ where: { id } });
      if (existing && (!existing.thumbnailUrl || existing.thumbnailUrl.includes('instagram.com') || existing.thumbnailUrl.includes('youtube.com') || existing.thumbnailUrl.includes('social-placeholder'))) {
        updateData.thumbnailUrl = resolveThumbnailUrl(validated.url, validated.platform || existing.platform);
      }
    }

    const reel = await prisma.socialReel.update({
      where: { id },
      data: updateData
    });

    res.json(reel);
  } catch (error: any) {
    console.error('Failed to update reel:', error);
    res.status(400).json({ error: 'Failed to update reel' });
  }
});

// DELETE /api/reels/admin/:id (Admin - delete reel)
router.delete('/admin/:id', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await prisma.socialReel.findUnique({ where: { id } });

    if (existing && existing.thumbnailUrl.startsWith('/uploads/reels/')) {
      const localPath = path.join(process.cwd(), existing.thumbnailUrl);
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (e) {
          console.warn('Could not unlink thumbnail file:', localPath);
        }
      }
    }

    await prisma.socialReel.delete({ where: { id } });
    res.json({ success: true, message: 'Reel deleted successfully' });
  } catch (error: any) {
    console.error('Failed to delete reel:', error);
    res.status(400).json({ error: 'Failed to delete reel' });
  }
});

export { router as reelsRouter };
