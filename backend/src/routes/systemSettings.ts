import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { z } from 'zod';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';
import { createAuditLog } from '../utils/auditLogger';

const router = Router();

const DEFAULT_SETTINGS_ID = 'system_settings';

const updateSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().nullable().optional(),
  bookingsEnabled: z.boolean().optional(),
  bookingsPausedMessage: z.string().nullable().optional(),
  emergencyClosedToday: z.boolean().optional(),
  emergencyClosedMessage: z.string().nullable().optional(),
  walkInsEnabled: z.boolean().optional(),
  contactPhone: z.string().nullable().optional(),
});

// Helper: Ensure default system settings record exists in database
export async function getOrCreateSystemSettings() {
  let settings = await prisma.systemSettings.findUnique({
    where: { id: DEFAULT_SETTINGS_ID },
  });

  if (!settings) {
    settings = await prisma.systemSettings.create({
      data: {
        id: DEFAULT_SETTINGS_ID,
        maintenanceMode: false,
        maintenanceMessage: 'We are currently undergoing scheduled maintenance. We will be back online shortly!',
        bookingsEnabled: true,
        bookingsPausedMessage: 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.',
        emergencyClosedToday: false,
        emergencyClosedMessage: 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.',
        walkInsEnabled: true,
        contactPhone: '+92 300 1234567',
      },
    });
  }

  return settings;
}

// GET /api/system/settings (Public - for website check)
router.get('/', async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSystemSettings();
    res.json({
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage,
      bookingsEnabled: settings.bookingsEnabled,
      bookingsPausedMessage: settings.bookingsPausedMessage,
      emergencyClosedToday: settings.emergencyClosedToday,
      emergencyClosedMessage: settings.emergencyClosedMessage,
      contactPhone: settings.contactPhone,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    console.error('Failed to get public system settings:', error);
    res.json({
      maintenanceMode: false,
      maintenanceMessage: 'We are currently undergoing scheduled maintenance. We will be back online shortly!',
      bookingsEnabled: true,
      bookingsPausedMessage: 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.',
      emergencyClosedToday: false,
      emergencyClosedMessage: 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.',
      contactPhone: '+92 300 1234567',
    });
  }
});

// GET /api/admin/system/settings (Admin Panel - SUPER_ADMIN & MANAGER)
router.get('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const settings = await getOrCreateSystemSettings();
    res.json(settings);
  } catch (error) {
    console.error('Failed to get admin system settings:', error);
    res.status(500).json({ error: 'Failed to retrieve system settings' });
  }
});

// PUT /api/admin/system/settings (Super Admin Only)
router.put('/admin', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  try {
    const validatedData = updateSettingsSchema.parse(req.body);

    const updated = await prisma.systemSettings.upsert({
      where: { id: DEFAULT_SETTINGS_ID },
      create: {
        id: DEFAULT_SETTINGS_ID,
        maintenanceMode: validatedData.maintenanceMode ?? false,
        maintenanceMessage: validatedData.maintenanceMessage ?? 'We are currently undergoing scheduled maintenance. We will be back online shortly!',
        bookingsEnabled: validatedData.bookingsEnabled ?? true,
        bookingsPausedMessage: validatedData.bookingsPausedMessage ?? 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.',
        emergencyClosedToday: validatedData.emergencyClosedToday ?? false,
        emergencyClosedMessage: validatedData.emergencyClosedMessage ?? 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.',
        walkInsEnabled: validatedData.walkInsEnabled ?? true,
        contactPhone: validatedData.contactPhone ?? '+92 300 1234567',
      },
      update: {
        ...(validatedData.maintenanceMode !== undefined && { maintenanceMode: validatedData.maintenanceMode }),
        ...(validatedData.maintenanceMessage !== undefined && { maintenanceMessage: validatedData.maintenanceMessage }),
        ...(validatedData.bookingsEnabled !== undefined && { bookingsEnabled: validatedData.bookingsEnabled }),
        ...(validatedData.bookingsPausedMessage !== undefined && { bookingsPausedMessage: validatedData.bookingsPausedMessage }),
        ...(validatedData.emergencyClosedToday !== undefined && { emergencyClosedToday: validatedData.emergencyClosedToday }),
        ...(validatedData.emergencyClosedMessage !== undefined && { emergencyClosedMessage: validatedData.emergencyClosedMessage }),
        ...(validatedData.walkInsEnabled !== undefined && { walkInsEnabled: validatedData.walkInsEnabled }),
        ...(validatedData.contactPhone !== undefined && { contactPhone: validatedData.contactPhone }),
      },
    });

    if ((req as AuthenticatedAdminRequest).admin?.id) {
      createAuditLog((req as AuthenticatedAdminRequest).admin!.id, 'UPDATE', 'SETTINGS', DEFAULT_SETTINGS_ID, {
        ...validatedData
      });
    }

    res.json({
      message: 'System settings updated successfully',
      settings: updated,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Failed to update system settings:', error);
    res.status(500).json({ error: 'Failed to update system settings' });
  }
});

// POST /api/admin/system/clear-cache (Super Admin & Manager)
router.post('/admin/clear-cache', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req: Request, res: Response) => {
  try {
    const websiteUrl = process.env.WEBSITE_URL || 'http://localhost:3002';
    let websiteRevalidated = false;

    // Trigger website Next.js revalidation
    try {
      const response = await fetch(`${websiteUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        websiteRevalidated = true;
      }
    } catch (fetchErr) {
      console.warn('Website revalidation ping skipped or unavailable:', fetchErr);
    }

    res.json({
      success: true,
      message: 'Cache cleared! Changes will now appear immediately.',
      websiteRevalidated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Failed to clear cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export { router as systemSettingsRouter };
