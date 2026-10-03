import {pagination,pageResult} from '../middleware/apiContract';
import { Router } from 'express';
import { AdminRole } from '@prisma/client';
import { prisma } from '../db';
import { requireAdminAuth, AuthenticatedAdminRequest } from '../middleware/adminAuth';

const router = Router();

// Protect all attendance routes: only SUPER_ADMIN
router.use(requireAdminAuth([AdminRole.SUPER_ADMIN]));

// GET /api/admin/attendance - Fetch attendance logs with optional filters (staffId, startDate, endDate)
router.get('/', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const { staffId, startDate, endDate } = req.query;

    const whereClause: any = {};

    if (staffId && typeof staffId === 'string' && staffId !== 'ALL') {
      whereClause.adminUserId = staffId;
    }

    if (startDate || endDate) {
      whereClause.loginAt = {};
      if (startDate && typeof startDate === 'string') {
        whereClause.loginAt.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.loginAt.lte = end;
      }
    }

    const listQuery:any = {
      where: whereClause,
      include: {
        adminUser: {
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
        loginAt: 'desc',
      },
    };
      const pager=pagination(req,res);
      const logs=await prisma.attendanceLog.findMany({...listQuery,...(pager.requested ? {skip:pager.skip,take:pager.limit}:{})});
      if(pager.requested)pageResult(res,await prisma.attendanceLog.count({where:listQuery.where}),pager.page,pager.limit);

    return res.json(logs);
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/attendance/active-duty - Fetch staff currently on duty (logged in today without logoutAt)
router.get('/active-duty', async (req: AuthenticatedAdminRequest, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const activeLogs = await prisma.attendanceLog.findMany({
      where: {
        logoutAt: null,
        loginAt: {
          gte: todayStart,
        },
      },
      include: {
        adminUser: {
          select: {
            id: true,
            name: true,
            username: true,
            role: true,
            avatarUrl: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: {
        loginAt: 'desc',
      },
    });

    return res.json(activeLogs);
  } catch (error) {
    next(error);
  }
});

export { router as attendanceRouter };
