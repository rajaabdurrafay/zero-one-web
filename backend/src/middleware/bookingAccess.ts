import { Response, NextFunction } from 'express';
import { prisma } from '../db';
import { verifyBookingAccess, verifyToken } from '../utils/auth';
import { requireAdminAuth } from './adminAuth';
import { requireCustomerAuth, AuthenticatedCustomerRequest } from './customerAuth';
export function requireBookingAccess(group = false) {
  return async (req: AuthenticatedCustomerRequest, res: Response, next: NextFunction) => {
    try {
      const id = group ? req.params.groupId : req.params.id;
      const access = req.get('x-booking-token');
      if (access && verifyBookingAccess(access, id, group)) return next();
      const authorization = req.get('authorization');
      if (!authorization && !req.get('x-admin-token')) return res.status(401).json({ error: 'Booking authentication required.' });
      if (authorization?.startsWith('Bearer ') && verifyToken(authorization.slice(7))) {
        return requireCustomerAuth(req, res, async () => {
          try {
            const booking = group ? await prisma.bookingGroup.findUnique({ where: { id } }) : await prisma.booking.findUnique({ where: { id } });
            if (!booking || booking.customerId !== req.customer!.customerId) return res.status(404).json({ error: 'Booking not found.' });
            next();
          } catch (error) { next(error); }
        });
      }
      return requireAdminAuth()(req, res, next);
    } catch (error) { next(error); }
  };
}
