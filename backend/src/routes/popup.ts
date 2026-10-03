import { decodeImage, deleteLocalUpload } from '../utils/uploads';
import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole, PopupFrequency } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';
import fs from 'fs';
import path from 'path';

const router = Router();

const DEFAULT_POPUP_ID = 'default_popup';

const updatePopupSchema = z.object({
  isEnabled: z.boolean().default(false),
  delaySeconds: z.number().int().min(0).max(120).default(4),
  frequency: z.enum(['ONCE_PER_SESSION', 'EVERY_VISIT', 'ONCE_PER_DAY']).default('ONCE_PER_SESSION'),
  heading: z.string().min(1).default('Special Announcement'),
  message: z.string().min(1).default('Check out our latest deals and book your gaming or snooker arena slot today!'),
  buttonText: z.string().min(1).default('Book Your Slot'),
  buttonLink: z.string().trim().min(1).max(2000).refine(value=>/^\/(?!\/)[^\\]*$/.test(value) || /^https?:\/\/[^\s]+$/i.test(value),'Use an internal path or HTTP(S) URL').default('/book'),
  imageUrl: z.string().nullable().optional(),
});

// Helper: Ensure default popup record exists in database
async function getOrCreatePopupSettings() {
  let popup = await prisma.sitePopup.findUnique({
    where: { id: DEFAULT_POPUP_ID },
  });

  if (!popup) {
    popup = await prisma.sitePopup.create({
      data: {
        id: DEFAULT_POPUP_ID,
        isEnabled: false,
        delaySeconds: 4,
        frequency: PopupFrequency.ONCE_PER_SESSION,
        heading: 'Special Announcement',
        message: 'Check out our latest deals and book your gaming or snooker arena slot today!',
        buttonText: 'Book Your Slot',
        buttonLink: '/book',
        imageUrl: null,
      },
    });
  }

  return popup;
}

// GET /api/popup-settings (Public Website)
router.get('/', async (req: Request, res: Response) => {
  try {
    const popup = await getOrCreatePopupSettings();
    res.json(popup);
  } catch (error) {
    console.error('Failed to get site popup settings:', error);
    res.status(500).json({
      id: DEFAULT_POPUP_ID,
      isEnabled: false,
      delaySeconds: 4,
      frequency: 'ONCE_PER_SESSION',
      heading: 'Special Announcement',
      message: 'Check out our latest deals and book your gaming or snooker arena slot today!',
      buttonText: 'Book Your Slot',
      buttonLink: '/book',
      imageUrl: null,
    });
  }
});

// GET /api/admin/popup-settings (Admin Panel)
router.get('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const popup = await getOrCreatePopupSettings();
    res.json(popup);
  } catch (error) {
    console.error('Failed to get admin site popup settings:', error);
    res.status(500).json({ error: 'Failed to retrieve popup settings' });
  }
});

// PUT /api/admin/popup-settings (Admin Save - Super Admin Only)
router.put('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const validatedData = updatePopupSchema.parse(req.body);

    const updated = await prisma.sitePopup.upsert({
      where: { id: DEFAULT_POPUP_ID },
      create: {
        id: DEFAULT_POPUP_ID,
        isEnabled: validatedData.isEnabled,
        delaySeconds: validatedData.delaySeconds,
        frequency: validatedData.frequency as PopupFrequency,
        heading: validatedData.heading,
        message: validatedData.message,
        buttonText: validatedData.buttonText,
        buttonLink: validatedData.buttonLink,
        imageUrl: validatedData.imageUrl,
      },
      update: {
        isEnabled: validatedData.isEnabled,
        delaySeconds: validatedData.delaySeconds,
        frequency: validatedData.frequency as PopupFrequency,
        heading: validatedData.heading,
        message: validatedData.message,
        buttonText: validatedData.buttonText,
        buttonLink: validatedData.buttonLink,
        imageUrl: validatedData.imageUrl,
      },
    });

    res.json({
      message: 'Popup settings updated successfully',
      popup: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update popup settings:', error);
    res.status(500).json({ error: 'Failed to update popup settings' });
  }
});

// POST /api/admin/popup-settings/upload-image
router.post('/upload-image', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const { imageBase64, fileName } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    // Prepare uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', 'popup');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Strip metadata prefix if data uri
    const { buffer, extension } = decodeImage(imageBase64);

    const uniqueName = `popup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const filePath = path.join(uploadsDir, uniqueName);

    fs.writeFileSync(filePath, buffer);

    const imageUrl = `/uploads/popup/${uniqueName}`;

    res.json({
      message: 'Popup image uploaded successfully',
      imageUrl,
    });
  } catch (error) {
    console.error('Failed to upload popup image:', error);
    res.status(500).json({ error: 'Failed to process image upload' });
  }
});

export { router as popupRouter };
