import { Router } from 'express';
import { AdminRole } from '@prisma/client';
import { prisma } from '../db';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';

const router = Router();

// Protect endpoint: Only SUPER_ADMIN can view audit logs
router.use(requireAdminAuth([AdminRole.SUPER_ADMIN]));

// GET /api/audit-logs - Fetch all audit logs with staff details
router.get('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        staff: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json(logs);
  } catch (error) {
    next(error);
  }
});

export { router as auditLogsRouter };
