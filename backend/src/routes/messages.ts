import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { AdminRole } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

// Validation schema for incoming public contact inquiries
const contactSubmissionSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().min(7, 'Valid phone number is required').optional().nullable().or(z.literal('')),
  subject: z.string().optional().nullable(),
  message: z.string().min(3, 'Message must be at least 3 characters'),
});

// 1. PUBLIC: POST /api/contact (or POST /api/messages) - Submit contact inquiry from website
router.post('/', async (req, res, next) => {
  try {
    const data = contactSubmissionSchema.parse(req.body);

    const created = await prisma.contactMessage.create({
      data: {
        name: data.name.trim(),
        email: data.email && data.email.trim() ? data.email.trim().toLowerCase() : null,
        phone: data.phone && data.phone.trim() ? data.phone.trim() : null,
        subject: data.subject && data.subject.trim() ? data.subject.trim() : 'General Inquiry',
        message: data.message.trim(),
        isRead: false,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Message sent! We will get back to you soon.',
      id: created.id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    next(error);
  }
});

// 2. ADMIN: GET /api/admin/messages/unread-count - Get total unread count for sidebar badge
router.get(
  '/unread-count',
  requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]),
  async (req, res, next) => {
    try {
      const count = await prisma.contactMessage.count({
        where: { isRead: false },
      });
      return res.json({ unreadCount: count });
    } catch (error) {
      next(error);
    }
  }
);

// 3. ADMIN: GET /api/admin/messages - Fetch messages with filters (status, dateFrom, dateTo, search, sortOrder)
router.get(
  '/',
  requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]),
  async (req, res, next) => {
    try {
      const { status, isRead, dateFrom, dateTo, search, sortOrder } = req.query;

      const where: any = {};

      // Status / isRead filter
      if (status === 'unread' || isRead === 'false' || (isRead as any) === false) {
        where.isRead = false;
      } else if (status === 'read' || isRead === 'true' || (isRead as any) === true) {
        where.isRead = true;
      }

      // Date range filtering on createdAt
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom && typeof dateFrom === 'string') {
          const fromDate = new Date(dateFrom);
          if (!isNaN(fromDate.getTime())) {
            where.createdAt.gte = fromDate;
          }
        }
        if (dateTo && typeof dateTo === 'string') {
          const toDate = new Date(dateTo);
          if (!isNaN(toDate.getTime())) {
            // If dateTo is just a date string (length <= 10, e.g. YYYY-MM-DD), set to end of day
            if (dateTo.length <= 10) {
              toDate.setHours(23, 59, 59, 999);
            }
            where.createdAt.lte = toDate;
          }
        }
      }

      // Search filter across name, email, phone, subject, message
      if (search && typeof search === 'string' && search.trim().length > 0) {
        const searchTerm = search.trim();
        where.OR = [
          { name: { contains: searchTerm } },
          { email: { contains: searchTerm } },
          { phone: { contains: searchTerm } },
          { subject: { contains: searchTerm } },
          { message: { contains: searchTerm } },
        ];
      }

      // Sorting order
      const orderDirection: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

      const messages = await prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: orderDirection },
      });

      return res.json(messages);
    } catch (error) {
      next(error);
    }
  }
);

// 4. ADMIN: PATCH /api/admin/messages/:id/read - Mark message as read / toggle
router.patch(
  '/:id/read',
  requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const isReadParam = req.body.isRead;
      const isRead = typeof isReadParam === 'boolean' ? isReadParam : true;

      const existing = await prisma.contactMessage.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Message not found' });
      }

      const updated = await prisma.contactMessage.update({
        where: { id },
        data: { isRead },
      });

      return res.json({
        success: true,
        message: `Message marked as ${isRead ? 'read' : 'unread'}`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

// 5. ADMIN: DELETE /api/admin/messages/:id - Delete a contact message
router.delete(
  '/:id',
  requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existing = await prisma.contactMessage.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Message not found' });
      }

      await prisma.contactMessage.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: 'Message deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as messagesRouter };
