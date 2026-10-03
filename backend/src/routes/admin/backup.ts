import { Router, Request, Response } from 'express';
import { prisma } from '../../db';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../../middleware/adminAuth';

const router = Router();

// Rate limiting flag to prevent overlapping heavy requests
let isBackupRunning = false;

// GET /api/admin/backup/full
router.get('/full', requireAdminAuth([AdminRole.SUPER_ADMIN]), async (req: Request, res: Response) => {
  if (isBackupRunning) {
    return res.status(429).json({ error: 'A database backup is already currently in progress. Please wait a few moments.' });
  }

  try {
    isBackupRunning = true;

    // Fetch all tables in parallel, stripping out sensitive credentials/tokens
    const [
      bookings,
      bookingGroups,
      customers,
      resources,
      activities,
      offers,
      addonItems,
      reviews,
      galleryImages,
      socialReels,
      sessions,
      sessionLogs,
      contactMessages,
      systemSettings,
      themeSettings,
      popupSettings,
      adminUsers
    ] = await Promise.all([
      prisma.booking.findMany({ include: { addons: true } }),
      prisma.bookingGroup.findMany(),
      prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          isRegistered: true,
          profilePictureUrl: true,
          createdAt: true,
          // Explicitly excluding: password, resetToken, resetTokenExpiry
        },
      }),
      prisma.resource.findMany(),
      prisma.activity.findMany(),
      prisma.offer.findMany(),
      prisma.addonItem.findMany(),
      prisma.review.findMany(),
      prisma.galleryImage.findMany(),
      prisma.socialReel.findMany(),
      prisma.session.findMany(),
      prisma.sessionLog.findMany(),
      prisma.contactMessage.findMany(),
      prisma.systemSettings.findMany(),
      prisma.themeSettings.findMany(),
      prisma.sitePopup.findMany(),
      prisma.adminUser.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          // Explicitly excluding: password
        },
      }),
    ]);

    res.setHeader('Cache-Control', 'private, no-store');
    const backupData = {
      meta: {
        app: 'ZERO ONE Cue & Play',
        environment: process.env.NODE_ENV || 'production',
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        exportType: 'sanitized-business-data',
        restorableDatabaseBackup: false,
        tableCounts: {
          bookings: bookings.length,
          bookingGroups: bookingGroups.length,
          customers: customers.length,
          resources: resources.length,
          activities: activities.length,
          offers: offers.length,
          addonItems: addonItems.length,
          reviews: reviews.length,
          galleryImages: galleryImages.length,
          socialReels: socialReels.length,
          sessions: sessions.length,
          sessionLogs: sessionLogs.length,
          contactMessages: contactMessages.length,
          adminUsers: adminUsers.length,
        },
      },
      data: {
        bookings,
        bookingGroups,
        customers,
        resources,
        activities,
        offers,
        addonItems,
        reviews,
        galleryImages,
        socialReels,
        sessions,
        sessionLogs,
        contactMessages,
        systemSettings,
        themeSettings,
        popupSettings,
        adminUsers,
      },
    };

    const fileName = `zeroone-backup-${new Date().toISOString().split('T')[0]}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error('Failed to generate full database backup:', error);
    res.status(500).json({ error: 'Failed to generate database backup' });
  } finally {
    isBackupRunning = false;
  }
});

export { router as backupRouter };
