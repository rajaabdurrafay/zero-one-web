import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { comparePassword, signAdminToken, credentialTag, hashPassword } from '../utils/auth';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';
import {
  extractClientIp,
  generateDeviceFingerprint,
  getApproximateLocation,
  parseUserAgent,
  sendNewDeviceLoginEmail,
} from '../utils/deviceTracker';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required').max(128),
});

// POST /api/auth/admin/login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const username = data.username.trim();

    const adminUser = await prisma.adminUser.findFirst({
      where: {
        username: {
          equals: username,
        },
      },
    });

    if (!adminUser) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const isMatch = await comparePassword(data.password, adminUser.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!adminUser.isActive) {
      return res.status(403).json({
        error: 'This staff account has been deactivated. Please contact Super Admin.',
      });
    }

    if (!adminUser.password.startsWith('scrypt:')) {
      adminUser.password = await hashPassword(data.password);
      await prisma.adminUser.update({ where: { id: adminUser.id }, data: { password: adminUser.password } });
    }
    // Update lastLoginAt
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { lastLoginAt: new Date() },
    });

    // Create Attendance Log
    await prisma.attendanceLog.create({
      data: {
        adminUserId: adminUser.id,
        loginAt: new Date(),
        date: new Date(),
      },
    });

    // ──────── NEW DEVICE DETECTION ────────
    const userAgent = (req.headers['user-agent'] || '') as string;
    const ipAddress = extractClientIp(req);
    const deviceFingerprint = generateDeviceFingerprint(ipAddress, userAgent);

    let isNewDevice = false;
    let deviceLocation = '';
    let whatsappAlertUrl: string | undefined;

    const existingSession = await prisma.loginSession.findFirst({
      where: {
        adminUserId: adminUser.id,
        deviceFingerprint,
      },
    });

    let sessionId = existingSession?.id;
    if (!existingSession) {
      // NEW unrecognized device/browser
      isNewDevice = true;
      deviceLocation = await getApproximateLocation(ipAddress);

      const createdSession = await prisma.loginSession.create({
        data: {
          adminUserId: adminUser.id,
          deviceFingerprint,
          ipAddress,
          userAgent,
          location: deviceLocation,
        },
      });

      sessionId = createdSession.id;

      // Only fire alerts for SUPER_ADMIN role
      if (adminUser.role === 'SUPER_ADMIN') {
        const alertEmail = process.env.ADMIN_ALERT_EMAIL || process.env.RESEND_TO_EMAIL;
        if (alertEmail) {
          // Fire-and-forget the email (don't block login)
          sendNewDeviceLoginEmail({
            toEmail: alertEmail,
            adminName: adminUser.name,
            username: adminUser.username,
            ipAddress,
            userAgent,
            location: deviceLocation,
            loginTime: new Date(),
          }).catch((err) => console.error('[Login Alert] Email dispatch error:', err));
        }

        // WhatsApp manual alert link
        const adminPhone = process.env.ADMIN_WHATSAPP_PHONE;
        if (adminPhone) {
          const { browser, os } = parseUserAgent(userAgent);
          const waText = encodeURIComponent(
            `🔐 ZeroOne Security Alert\n\nNew login detected for @${adminUser.username}\n` +
            `Time: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}\n` +
            `Device: ${browser} on ${os}\n` +
            `IP: ${ipAddress}\n` +
            `Location: ${deviceLocation}\n\n` +
            `If this wasn't you, change your password immediately.`
          );
          whatsappAlertUrl = `https://wa.me/${adminPhone.replace(/[^0-9]/g, '')}?text=${waText}`;
        }
      }
    } else {
      // Known device — update lastSeenAt
      await prisma.loginSession.update({
        where: { id: existingSession.id },
        data: {
          lastSeenAt: new Date(),
          ipAddress,
          userAgent,
        },
      });
    }

    const token = signAdminToken({
      id: adminUser.id,
      username: adminUser.username,
      name: adminUser.name,
      role: adminUser.role,
      credentialTag: credentialTag(adminUser.password),
      sessionId: sessionId!,
    });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        name: adminUser.name,
        role: adminUser.role,
        avatarUrl: adminUser.avatarUrl,
      },
      // New device security payload
      isNewDevice,
      ...(isNewDevice && {
        deviceInfo: {
          ipAddress,
          location: deviceLocation,
          ...parseUserAgent(userAgent),
        },
        whatsappAlertUrl,
      }),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// GET /api/auth/admin/me
router.get('/me', requireAdminAuth(), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: req.admin!.id },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin account not found.' });
    }

    return res.json({ user: admin });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/admin/logout
router.post('/logout', requireAdminAuth(), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const adminId = req.admin!.id;

    // Find the latest open attendance log for this user
    const latestLog = await prisma.attendanceLog.findFirst({
      where: {
        adminUserId: adminId,
        logoutAt: null,
      },
      orderBy: { loginAt: 'desc' },
    });

    if (latestLog) {
      const logoutAt = new Date();
      const durationMs = logoutAt.getTime() - latestLog.loginAt.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      await prisma.attendanceLog.update({
        where: { id: latestLog.id },
        data: {
          logoutAt,
          durationMinutes,
        },
      });
    }

    await prisma.loginSession.deleteMany({ where: { id: req.admin!.sessionId, adminUserId: adminId } });
    return res.json({ message: 'Logged out from backend tracking successfully' });
  } catch (error) {
    next(error);
  }
});

// ──────── RECENT LOGINS / LOGIN SESSIONS ────────

// GET /api/auth/admin/sessions — Fetch recognized login sessions (Super Admin only)
router.get('/sessions', requireAdminAuth(['SUPER_ADMIN']), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const adminId = req.admin!.id;
    const sessions = await prisma.loginSession.findMany({
      where: { adminUserId: adminId },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
    });

    // Enrich with human-readable browser/OS info
    const enriched = sessions.map((s: any) => {
      const { browser, os } = parseUserAgent(s.userAgent || '');
      return {
        ...s,
        browser,
        os,
      };
    });

    return res.json(enriched);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/auth/admin/sessions/:id — Remove a recognized device (Super Admin only)
router.delete('/sessions/:id', requireAdminAuth(['SUPER_ADMIN']), async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const sessionId = req.params.id;
    const adminId = req.admin!.id;

    // Ensure the session belongs to the authenticated admin
    const session = await prisma.loginSession.findFirst({
      where: { id: sessionId, adminUserId: adminId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Login session not found or not yours.' });
    }

    await prisma.loginSession.delete({ where: { id: sessionId } });

    return res.json({ message: 'Device session removed. Next login from this device will trigger a new alert.' });
  } catch (error) {
    next(error);
  }
});

export { router as adminAuthRouter };
