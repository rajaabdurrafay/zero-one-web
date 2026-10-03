import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../db';
import { hashPassword } from '../utils/auth';
import { AdminRole, BookingStatus } from '@prisma/client';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

// Helper to calculate customer aggregates
async function getAggregatedCustomerList(search?: string, sortBy: string = 'totalSpent', sortOrder: string = 'desc', tierFilter?: string) {
  const customers = await prisma.customer.findMany({
    include: {
      bookings: {
        where: {
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
          },
        },
        orderBy: {
          startTime: 'desc',
        },
        select: {
          id: true,
          startTime: true,
          totalPrice: true,
          status: true,
          isWalkIn: true,
        },
      },
    },
  });

  const phoneMap = new Map<
    string,
    {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      profilePictureUrl?: string | null;
      isRegistered: boolean;
      totalVisits: number;
      totalSpent: number;
      lastVisit: string | null;
      daysInactive: number | null;
      firstVisit: string | null;
      isVIP: boolean;
      vipTier: 'VIP' | 'LOYAL' | 'REGULAR';
      createdAt: string;
    }
  >();

  for (const c of customers) {
    const cleanPhone = (c.phone || '').trim();
    if (!cleanPhone) continue;

    const visits = c.bookings.length;
    const spent = c.bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const mostRecentVisit = c.bookings.length > 0 ? c.bookings[0].startTime.toISOString() : null;
    const oldestVisit = c.bookings.length > 0 ? c.bookings[c.bookings.length - 1].startTime.toISOString() : null;

    if (!phoneMap.has(cleanPhone)) {
      const isVip = visits >= 5 || spent >= 5000;
      const tier = spent >= 15000 || visits >= 15 ? 'VIP' : isVip ? 'LOYAL' : 'REGULAR';
      const daysInactive = mostRecentVisit
        ? Math.floor((Date.now() - new Date(mostRecentVisit).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      phoneMap.set(cleanPhone, {
        id: c.id,
        name: c.name || 'Anonymous Guest',
        phone: cleanPhone,
        email: c.email || null,
        profilePictureUrl: c.profilePictureUrl || null,
        isRegistered: c.isRegistered,
        totalVisits: visits,
        totalSpent: spent,
        lastVisit: mostRecentVisit,
        daysInactive,
        firstVisit: oldestVisit,
        isVIP: isVip,
        vipTier: tier,
        createdAt: c.createdAt.toISOString(),
      });
    } else {
      const existing = phoneMap.get(cleanPhone)!;
      existing.totalVisits += visits;
      existing.totalSpent += spent;

      if (c.name && (!existing.name || existing.name === 'Anonymous Guest' || c.isRegistered)) {
        existing.name = c.name;
      }
      if (c.email && !existing.email) {
        existing.email = c.email;
      }
      if (c.profilePictureUrl && !existing.profilePictureUrl) {
        existing.profilePictureUrl = c.profilePictureUrl;
      }
      if (c.isRegistered) {
        existing.isRegistered = true;
      }

      if (mostRecentVisit && (!existing.lastVisit || new Date(mostRecentVisit) > new Date(existing.lastVisit))) {
        existing.lastVisit = mostRecentVisit;
      }

      existing.daysInactive = existing.lastVisit
        ? Math.floor((Date.now() - new Date(existing.lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      existing.isVIP = existing.totalVisits >= 5 || existing.totalSpent >= 5000;
      existing.vipTier =
        existing.totalSpent >= 15000 || existing.totalVisits >= 15
          ? 'VIP'
          : existing.isVIP
          ? 'LOYAL'
          : 'REGULAR';
    }
  }

  let customerList = Array.from(phoneMap.values());

  // Search filter
  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    customerList = customerList.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.phone.toLowerCase().includes(q) ||
        (item.email && item.email.toLowerCase().includes(q))
    );
  }

  // Tier filter
  if (tierFilter) {
    const tf = tierFilter.toUpperCase();
    if (tf === 'VIP') {
      customerList = customerList.filter((item) => item.vipTier === 'VIP');
    } else if (tf === 'LOYAL') {
      customerList = customerList.filter((item) => item.vipTier === 'LOYAL' || item.vipTier === 'VIP');
    } else if (tf === 'REGISTERED') {
      customerList = customerList.filter((item) => item.isRegistered);
    } else if (tf === 'CHURN_RISK' || tf === 'AT_RISK') {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      customerList = customerList.filter(
        (item) =>
          item.totalVisits >= 2 &&
          item.lastVisit !== null &&
          new Date(item.lastVisit).getTime() < thirtyDaysAgo
      );
    }
  }

  // Sorting
  customerList.sort((a, b) => {
    const order = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'totalVisits') {
      return (a.totalVisits - b.totalVisits) * order;
    }
    if (sortBy === 'lastVisit') {
      const dateA = a.lastVisit ? new Date(a.lastVisit).getTime() : 0;
      const dateB = b.lastVisit ? new Date(b.lastVisit).getTime() : 0;
      return (dateA - dateB) * order;
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name) * order;
    }
    return (a.totalSpent - b.totalSpent) * order;
  });

  return customerList;
}

// GET /api/customers (or /api/admin/customers) - Fetch aggregated members & VIPs
router.get('/', requireAdminAuth(), async (req, res, next) => {
  try {
    const { search, sortBy = 'totalSpent', sortOrder = 'desc', tier } = req.query;
    const customerList = await getAggregatedCustomerList(
      search as string | undefined,
      sortBy as string,
      sortOrder as string,
      tier as string | undefined
    );
    res.json(customerList);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/churn-risk (or /api/admin/churn-risk) - Fetch customers who haven't visited in 30+ days (2+ past visits)
router.get('/churn-risk', requireAdminAuth(), async (req, res, next) => {
  try {
    const { search, sortBy = 'lastVisit', sortOrder = 'asc' } = req.query;
    const customerList = await getAggregatedCustomerList(
      search as string | undefined,
      sortBy as string,
      sortOrder as string,
      'CHURN_RISK'
    );
    res.json({
      count: customerList.length,
      thresholdDays: 30,
      customers: customerList,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/export - Export customers to CSV with active filters
router.get('/export', requireAdminAuth(), async (req, res, next) => {
  try {
    const { search, sortBy = 'totalSpent', sortOrder = 'desc', tier } = req.query;
    const customerList = await getAggregatedCustomerList(
      search as string | undefined,
      sortBy as string,
      sortOrder as string,
      tier as string | undefined
    );

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'Name',
      'Phone',
      'Email',
      'Tier',
      'Total Visits',
      'Total Spent (PKR)',
      'Last Visit',
      'Account Type',
      'Member Since',
    ];

    const rows = customerList.map((c) => {
      const lastVisitFormatted = c.lastVisit
        ? new Date(c.lastVisit).toLocaleString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          })
        : 'N/A';

      const memberSinceFormatted = c.createdAt
        ? new Date(c.createdAt).toLocaleDateString('en-PK', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'N/A';

      const tierLabel = c.vipTier === 'VIP' ? 'VIP Elite' : c.vipTier === 'LOYAL' ? 'Loyal Guest' : 'Regular';
      const accountType = c.isRegistered ? 'Registered Member' : 'Walk-in Guest';

      return [
        escapeCsv(c.name),
        escapeCsv(c.phone),
        escapeCsv(c.email || 'N/A'),
        escapeCsv(tierLabel),
        c.totalVisits,
        c.totalSpent,
        escapeCsv(lastVisitFormatted),
        escapeCsv(accountType),
        escapeCsv(memberSinceFormatted),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const today = new Date().toISOString().split('T')[0];
    const filename = `zeroone-customers-${today}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
});

// GET /api/customers/:id - Fetch single customer detailed profile & booking history
router.get('/:id', requireAdminAuth(), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find target customer record first to get phone
    const baseCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!baseCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const cleanPhone = (baseCustomer.phone || '').trim();

    // Query all records sharing this phone number to aggregate bookings & profile
    const allRecords = await prisma.customer.findMany({
      where: { phone: cleanPhone },
      include: {
        bookings: {
          orderBy: { startTime: 'desc' },
          include: {
            resource: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
            appliedOffer: {
              select: {
                id: true,
                title: true,
                discountValue: true,
                discountType: true,
              },
            },
          },
        },
      },
    });

    let primaryName = baseCustomer.name || 'Anonymous Guest';
    let primaryEmail = baseCustomer.email || null;
    let primaryProfilePicture = baseCustomer.profilePictureUrl || null;
    let isRegistered = baseCustomer.isRegistered;
    let createdAt = baseCustomer.createdAt;

    const allBookings = [];
    for (const record of allRecords) {
      if (record.isRegistered) isRegistered = true;
      if (record.name && primaryName === 'Anonymous Guest') primaryName = record.name;
      if (record.email && !primaryEmail) primaryEmail = record.email;
      if (record.profilePictureUrl && !primaryProfilePicture) primaryProfilePicture = record.profilePictureUrl;
      if (record.createdAt < createdAt) createdAt = record.createdAt;
      allBookings.push(...record.bookings);
    }

    // Sort bookings by startTime desc
    allBookings.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // Compute metrics on CONFIRMED and COMPLETED bookings
    const confirmedOrCompleted = allBookings.filter(
      (b) => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED
    );

    const totalVisits = confirmedOrCompleted.length;
    const totalSpent = confirmedOrCompleted.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
    const avgSpendPerVisit = totalVisits > 0 ? Math.round(totalSpent / totalVisits) : 0;
    const lastVisit = confirmedOrCompleted.length > 0 ? confirmedOrCompleted[0].startTime.toISOString() : null;
    const firstVisit = confirmedOrCompleted.length > 0 ? confirmedOrCompleted[confirmedOrCompleted.length - 1].startTime.toISOString() : null;

    const isVIP = totalVisits >= 5 || totalSpent >= 5000;
    const vipTier: 'VIP' | 'LOYAL' | 'REGULAR' =
      totalSpent >= 15000 || totalVisits >= 15 ? 'VIP' : isVIP ? 'LOYAL' : 'REGULAR';

    res.json({
      id: baseCustomer.id,
      name: primaryName,
      phone: cleanPhone,
      email: primaryEmail,
      profilePictureUrl: primaryProfilePicture,
      isRegistered,
      createdAt: createdAt.toISOString(),
      stats: {
        totalVisits,
        totalSpent,
        avgSpendPerVisit,
        lastVisit,
        firstVisit,
        isVIP,
        vipTier,
        totalBookingsCount: allBookings.length,
      },
      bookings: allBookings.map((b) => ({
        id: b.id,
        resourceId: b.resourceId,
        resourceName: b.resource?.name || 'Station',
        resourceType: b.resource?.type || 'SNOOKER',
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        status: b.status,
        totalPrice: b.totalPrice,
        discountAmount: b.discountAmount,
        appliedOfferTitle: b.appliedOffer?.title || null,
        isWalkIn: b.isWalkIn,
        paymentMethod: b.paymentMethod,
        amountPaid: b.amountPaid,
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/customers/:id/reset-password - Admin manual password reset fallback (Super Admin & Manager only)
router.post('/:id/reset-password', requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]), async (req, res, next) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Generate a random 8-character temporary password
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let newPassword = '';
    const randomBytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      newPassword += chars[randomBytes[i] % chars.length];
    }

    const hashedPassword = await hashPassword(newPassword);

    // Update password for all customer records sharing this phone number
    await prisma.customer.updateMany({
      where: { phone: customer.phone },
      data: {
        password: hashedPassword,
        isRegistered: true,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    res.json({
      message: 'Password reset successfully by admin',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      newPassword,
    });
  } catch (error) {
    next(error);
  }
});

export { router as adminCustomersRouter };
