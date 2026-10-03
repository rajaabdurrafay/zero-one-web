import { RequestHandler, Request, Response, NextFunction } from 'express';
import { database, withinTransaction } from '../db';

class RejectedResponse extends Error {
  constructor(public status: number, public body: unknown) { super('Booking request rejected'); }
}

// Capture JSON until commit: neither success nor partial writes escape a failed transaction.
export function transactionalBooking(handler: (req: any, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    let status = 200;
    let body: unknown;
    const deferred = Object.create(res) as Response;
    deferred.status = (code: number) => { status = code; return deferred; };
    deferred.json = (value: unknown) => { body = value; if (status >= 400) throw new RejectedResponse(status, body); return deferred; };
    try {
      await database.$transaction(async tx => {
        const resourceIds = new Set<string>();
        if (typeof req.body?.resourceId === 'string') resourceIds.add(req.body.resourceId);
        if (Array.isArray(req.body?.items)) for (const item of req.body.items) if (typeof item?.resourceId === 'string') resourceIds.add(item.resourceId);
        const existingAddonIds: string[] = [];
        const bookingIds: string[] = [];
        let groupId = req.params.groupId;
        if (req.params.id) {
          const booking = await tx.booking.findUnique({ where: { id: req.params.id }, select: { id: true, resourceId: true, bookingGroupId: true, addons: { select: { addonItemId: true } } } });
          if (booking) resourceIds.add(booking.resourceId);
          if (booking) { bookingIds.push(booking.id); existingAddonIds.push(...booking.addons.map(addon => addon.addonItemId)); }
          if (booking?.bookingGroupId) groupId = booking.bookingGroupId;
        }
        if (groupId) {
          const bookings = await tx.booking.findMany({ where: { bookingGroupId: groupId }, select: { id: true, resourceId: true, addons: { select: { addonItemId: true } } } });
          for (const booking of bookings) { resourceIds.add(booking.resourceId); bookingIds.push(booking.id); existingAddonIds.push(...booking.addons.map(addon => addon.addonItemId)); }
        }
        if (resourceIds.size > 20 || (Array.isArray(req.body?.addons) && req.body.addons.length > 50)) throw new RejectedResponse(400, { error: 'Too many booking items.' });
        // Stable lock order prevents create/reschedule races across separate Node processes.
        for (const id of [...resourceIds].sort()) await tx.$queryRaw`SELECT id FROM Resource WHERE id = ${id} FOR UPDATE`;
        for (const id of [...new Set(bookingIds)].sort()) await tx.$queryRaw`SELECT id FROM Booking WHERE id = ${id} FOR UPDATE`;
        if (groupId) await tx.$queryRaw`SELECT id FROM BookingGroup WHERE id = ${groupId} FOR UPDATE`;
        const addonIds = [...new Set<string>([...existingAddonIds, ...(Array.isArray(req.body?.addons) ? req.body.addons : []).map((item: any) => item?.addonItemId).filter((id: unknown) => typeof id === 'string')])].sort();
        for (const id of addonIds) await tx.$queryRaw`SELECT id FROM AddonItem WHERE id = ${id} FOR UPDATE`;
        await withinTransaction(tx, () => handler(req, deferred, error => { throw error; }));
      }, { maxWait: 10_000, timeout: 20_000, isolationLevel: 'ReadCommitted' });
      res.status(status).json(body);
    } catch (error: any) {
      if (error instanceof RejectedResponse) return void res.status(error.status).json(error.body);
      if (error?.code === 'P2034') return void res.status(409).json({ error: 'Booking changed concurrently. Please retry.' });
      next(error);
    }
  };
}
