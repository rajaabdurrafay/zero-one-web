import { Router } from 'express';
import { BookingStatus } from '@prisma/client';
import { prisma } from '../db';

type CountVisits = (query: {
  where: { status: typeof BookingStatus.COMPLETED };
}) => Promise<number>;

// Only an aggregate is public; no customer, booking, payment or revenue details.
export function createPublicStatsRouter(countVisits: CountVisits) {
  const router = Router();
  router.get('/', async (_req, res) => {
    try {
      const totalPlayerVisits = await countVisits({ where: { status: BookingStatus.COMPLETED } });
      res.json({ totalPlayerVisits });
    } catch {
      res.status(503).json({ error: 'Visit statistics are temporarily unavailable.' });
    }
  });
  return router;
}

export const publicStatsRouter = createPublicStatsRouter((query) => prisma.booking.count(query));
