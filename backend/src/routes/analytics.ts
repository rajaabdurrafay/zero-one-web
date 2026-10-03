import { customerSelect } from '../utils/customerSelect';
import { Router } from 'express';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../db';
import { BookingStatus, AdminRole } from '@prisma/client';
import { autoCompleteExpiredBookings } from '../services/bookingAutomation';
import { requireAdminAuth } from '../middleware/adminAuth';

const router = Router();

// Protect all analytics routes - only SUPER_ADMIN and MANAGER have access
router.use(requireAdminAuth([AdminRole.SUPER_ADMIN, AdminRole.MANAGER]));

// 1. GET /api/analytics/summary -> Today, Week, Month totals & % comparisons
router.get('/summary', async (req, res, next) => {
  try {
    await autoCompleteExpiredBookings();

    const now = new Date();

    // Today boundary (00:00:00 to 23:59:59)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Yesterday boundary
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    // This Week boundary (last 7 days including today)
    const thisWeekStart = new Date(todayStart);
    thisWeekStart.setDate(thisWeekStart.getDate() - 6);

    // Prior Week boundary (previous 7-day window)
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setMilliseconds(lastWeekEnd.getMilliseconds() - 1);

    // This Month boundary (start of calendar month)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    // Prior Month boundary
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Active revenue statuses
    const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

    // Query all bookings in range
    const allBookings = await prisma.booking.findMany({
      where: {
        startTime: { gte: lastMonthStart }
      },
      select: {
        totalPrice: true,
        startTime: true,
        status: true,
        isWalkIn: true
      }
    });

    // Helper calculators
    const calculateStats = (start: Date, end: Date) => {
      const filtered = allBookings.filter(
        b => b.startTime >= start && b.startTime <= end
      );
      const valid = filtered.filter(b => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED);
      const revenue = valid.reduce((sum, b) => sum + b.totalPrice, 0);
      const totalBookings = filtered.length;
      const confirmedBookings = valid.length;
      return { revenue, totalBookings, confirmedBookings };
    };

    const todayStats = calculateStats(todayStart, todayEnd);
    const yesterdayStats = calculateStats(yesterdayStart, yesterdayEnd);
    const thisWeekStats = calculateStats(thisWeekStart, todayEnd);
    const lastWeekStats = calculateStats(lastWeekStart, lastWeekEnd);
    const thisMonthStats = calculateStats(thisMonthStart, todayEnd);
    const lastMonthStats = calculateStats(lastMonthStart, lastMonthEnd);

    const calcGrowth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      today: {
        revenue: todayStats.revenue,
        bookings: todayStats.totalBookings,
        confirmedBookings: todayStats.confirmedBookings,
        revenueChangePct: calcGrowth(todayStats.revenue, yesterdayStats.revenue),
        bookingsChangePct: calcGrowth(todayStats.totalBookings, yesterdayStats.totalBookings)
      },
      week: {
        revenue: thisWeekStats.revenue,
        bookings: thisWeekStats.totalBookings,
        revenueChangePct: calcGrowth(thisWeekStats.revenue, lastWeekStats.revenue)
      },
      month: {
        revenue: thisMonthStats.revenue,
        bookings: thisMonthStats.totalBookings,
        revenueChangePct: calcGrowth(thisMonthStats.revenue, lastMonthStats.revenue)
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2. GET /api/analytics/revenue?period=daily|weekly|monthly -> Revenue trend over time
router.get('/revenue', async (req, res, next) => {
  try {
    const period = (req.query.period as string) || 'daily';
    const now = new Date();
    const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

    let startDate: Date;
    let daysCount = 7;

    if (period === 'monthly') {
      daysCount = 30;
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'weekly') {
      daysCount = 14;
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 13);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // default: daily (last 7 days)
      daysCount = 7;
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    }

    const bookings = await prisma.booking.findMany({
      where: {
        startTime: { gte: startDate },
        status: { in: validStatuses }
      },
      select: {
        startTime: true,
        totalPrice: true,
        isWalkIn: true
      },
      orderBy: { startTime: 'asc' }
    });

    // Create a day-by-day map
    const trendMap: Record<string, { date: string; label: string; revenue: number; onlineRevenue: number; walkInRevenue: number; bookings: number }> = {};

    for (let i = 0; i < daysCount; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const isoDate = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap[isoDate] = {
        date: isoDate,
        label,
        revenue: 0,
        onlineRevenue: 0,
        walkInRevenue: 0,
        bookings: 0
      };
    }

    bookings.forEach((b) => {
      const dateKey = new Date(b.startTime).toISOString().split('T')[0];
      if (trendMap[dateKey]) {
        trendMap[dateKey].revenue += b.totalPrice;
        trendMap[dateKey].bookings += 1;
        if (b.isWalkIn) {
          trendMap[dateKey].walkInRevenue += b.totalPrice;
        } else {
          trendMap[dateKey].onlineRevenue += b.totalPrice;
        }
      }
    });

    res.json(Object.values(trendMap));
  } catch (error) {
    next(error);
  }
});

// 3. GET /api/analytics/activity-breakdown -> Bookings count & revenue per activity
router.get('/activity-breakdown', async (req, res, next) => {
  try {
    const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

    const [activities, bookings] = await Promise.all([
      prisma.activity.findMany(),
      prisma.booking.findMany({
        where: { status: { in: validStatuses } },
        include: { resource: true }
      })
    ]);

    const activityMap: Record<string, { name: string; type: string; count: number; revenue: number }> = {};

    activities.forEach((act) => {
      activityMap[act.resourceType] = {
        name: act.name,
        type: act.resourceType,
        count: 0,
        revenue: 0
      };
    });

    let totalRevenue = 0;
    let totalBookings = 0;

    bookings.forEach((b) => {
      const type = b.resource.type;
      if (!activityMap[type]) {
        activityMap[type] = {
          name: type,
          type,
          count: 0,
          revenue: 0
        };
      }
      activityMap[type].count += 1;
      activityMap[type].revenue += b.totalPrice;
      totalRevenue += b.totalPrice;
      totalBookings += 1;
    });

    const breakdown = Object.values(activityMap).map((item) => ({
      ...item,
      percentage: totalBookings > 0 ? Math.round((item.count / totalBookings) * 100) : 0,
      revenuePercentage: totalRevenue > 0 ? Math.round((item.revenue / totalRevenue) * 100) : 0
    }));

    res.json({
      breakdown,
      totalRevenue,
      totalBookings
    });
  } catch (error) {
    next(error);
  }
});

// 4. GET /api/analytics/peak-hours -> Hour-wise booking frequency (0 to 23 hours)
router.get('/peak-hours', async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] }
      },
      select: {
        startTime: true,
        totalPrice: true
      }
    });

    // Initialize 24 slots (12 AM to 11 PM)
    const hoursData = Array.from({ length: 24 }, (_, hour) => {
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      return {
        hour,
        label: `${hour12} ${ampm}`,
        bookings: 0,
        revenue: 0
      };
    });

    bookings.forEach((b) => {
      const localHour = new Date(b.startTime).getHours();
      if (hoursData[localHour]) {
        hoursData[localHour].bookings += 1;
        hoursData[localHour].revenue += b.totalPrice;
      }
    });

    res.json(hoursData);
  } catch (error) {
    next(error);
  }
});

// 5. GET /api/analytics/top-customers -> Customer ranking by bookings & spend
router.get('/top-customers', async (req, res, next) => {
  try {
    const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

    const customers = await prisma.customer.findMany({
      include: {
        bookings: {
          where: { status: { in: validStatuses } },
          select: { totalPrice: true, isWalkIn: true, createdAt: true }
        }
      }
    });

    const ranked = customers
      .map((c) => {
        const totalBookings = c.bookings.length;
        const totalSpend = c.bookings.reduce((sum, b) => sum + b.totalPrice, 0);
        const onlineCount = c.bookings.filter((b) => !b.isWalkIn).length;
        const walkInCount = c.bookings.filter((b) => b.isWalkIn).length;

        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          totalBookings,
          totalSpend,
          onlineCount,
          walkInCount
        };
      })
      .filter((c) => c.totalBookings > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend)
      .slice(0, 10);

    res.json(ranked);
  } catch (error) {
    next(error);
  }
});

// 6. GET /api/analytics/revenue-by-category?period=today|week|month|all
router.get('/revenue-by-category', async (req, res, next) => {
  try {
    const period = (req.query.period as string) || 'all';
    const now = new Date();
    const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

    let startDate: Date | undefined;

    if (period === 'today') {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } // 'all' leaves startDate undefined

    const [activities, bookings] = await Promise.all([
      prisma.activity.findMany(),
      prisma.booking.findMany({
        where: {
          status: { in: validStatuses },
          ...(startDate && { startTime: { gte: startDate } })
        },
        include: { resource: true }
      })
    ]);

    const categoryMap: Record<
      string,
      {
        activityName: string;
        resourceType: string;
        totalRevenue: number;
        totalBookings: number;
        onlineRevenue: number;
        walkInRevenue: number;
      }
    > = {};

    activities.forEach((act) => {
      categoryMap[act.resourceType] = {
        activityName: act.name,
        resourceType: act.resourceType,
        totalRevenue: 0,
        totalBookings: 0,
        onlineRevenue: 0,
        walkInRevenue: 0
      };
    });

    let grandTotalRevenue = 0;
    let grandTotalBookings = 0;

    bookings.forEach((b) => {
      const type = b.resource.type;
      if (!categoryMap[type]) {
        categoryMap[type] = {
          activityName: type,
          resourceType: type,
          totalRevenue: 0,
          totalBookings: 0,
          onlineRevenue: 0,
          walkInRevenue: 0
        };
      }
      categoryMap[type].totalRevenue += b.totalPrice;
      categoryMap[type].totalBookings += 1;
      if (b.isWalkIn) {
        categoryMap[type].walkInRevenue += b.totalPrice;
      } else {
        categoryMap[type].onlineRevenue += b.totalPrice;
      }
      grandTotalRevenue += b.totalPrice;
      grandTotalBookings += 1;
    });

    const categories = Object.values(categoryMap)
      .map((item) => {
        const avgRevenuePerBooking =
          item.totalBookings > 0 ? Math.round(item.totalRevenue / item.totalBookings) : 0;
        const percentOfTotal =
          grandTotalRevenue > 0 ? Math.round((item.totalRevenue / grandTotalRevenue) * 100) : 0;

        return {
          activityName: item.activityName,
          resourceType: item.resourceType,
          totalRevenue: item.totalRevenue,
          totalBookings: item.totalBookings,
          onlineRevenue: item.onlineRevenue,
          walkInRevenue: item.walkInRevenue,
          avgRevenuePerBooking,
          percentOfTotal
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue); // Highest to lowest

    const topPerformer = categories.length > 0 && categories[0].totalRevenue > 0 ? categories[0] : null;

    res.json({
      period,
      grandTotalRevenue,
      grandTotalBookings,
      topPerformer,
      categories
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to prepare consolidated analytics dataset based on period
async function getFullAnalyticsData(period: string = 'daily') {
  await autoCompleteExpiredBookings();

  const now = new Date();
  const validStatuses = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

  let daysCount = 7;
  let periodLabel = 'Last 7 Days';
  let periodSlug = '7days';

  if (period === 'monthly' || period === '30days' || period === '30') {
    daysCount = 30;
    periodLabel = 'Last 30 Days';
    periodSlug = '30days';
  } else if (period === 'weekly' || period === '14days' || period === '14') {
    daysCount = 14;
    periodLabel = 'Last 14 Days';
    periodSlug = '14days';
  } else {
    daysCount = 7;
    periodLabel = 'Last 7 Days';
    periodSlug = '7days';
  }

  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - (daysCount - 1));
  startDate.setHours(0, 0, 0, 0);

  const [activities, periodBookings, allTimeCustomers] = await Promise.all([
    prisma.activity.findMany(),
    prisma.booking.findMany({
      where: {
        startTime: { gte: startDate },
        status: { in: validStatuses }
      },
      include: {
        resource: true,
        customer: { select: customerSelect }
      },
      orderBy: { startTime: 'asc' }
    }),
    prisma.customer.findMany({
      include: {
        bookings: {
          where: {
            startTime: { gte: startDate },
            status: { in: validStatuses }
          },
          select: { totalPrice: true, isWalkIn: true }
        }
      }
    })
  ]);

  // 1. Daily Trend
  const trendMap: Record<string, { date: string; label: string; revenue: number; onlineRevenue: number; walkInRevenue: number; bookings: number }> = {};
  for (let i = 0; i < daysCount; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const isoDate = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    trendMap[isoDate] = {
      date: isoDate,
      label,
      revenue: 0,
      onlineRevenue: 0,
      walkInRevenue: 0,
      bookings: 0
    };
  }

  let totalPeriodRevenue = 0;
  let totalPeriodBookings = 0;
  let totalOnlineRevenue = 0;
  let totalWalkInRevenue = 0;

  periodBookings.forEach((b) => {
    const dateKey = new Date(b.startTime).toISOString().split('T')[0];
    if (trendMap[dateKey]) {
      trendMap[dateKey].revenue += b.totalPrice;
      trendMap[dateKey].bookings += 1;
      if (b.isWalkIn) {
        trendMap[dateKey].walkInRevenue += b.totalPrice;
        totalWalkInRevenue += b.totalPrice;
      } else {
        trendMap[dateKey].onlineRevenue += b.totalPrice;
        totalOnlineRevenue += b.totalPrice;
      }
    }
    totalPeriodRevenue += b.totalPrice;
    totalPeriodBookings += 1;
  });

  const dailyTrend = Object.values(trendMap);

  // 2. Activity Breakdown
  const activityMap: Record<string, { name: string; type: string; count: number; onlineCount: number; walkInCount: number; revenue: number }> = {};
  activities.forEach((act) => {
    activityMap[act.resourceType] = {
      name: act.name,
      type: act.resourceType,
      count: 0,
      onlineCount: 0,
      walkInCount: 0,
      revenue: 0
    };
  });

  periodBookings.forEach((b) => {
    const type = b.resource?.type || 'OTHER';
    if (!activityMap[type]) {
      activityMap[type] = {
        name: type,
        type,
        count: 0,
        onlineCount: 0,
        walkInCount: 0,
        revenue: 0
      };
    }
    activityMap[type].count += 1;
    activityMap[type].revenue += b.totalPrice;
    if (b.isWalkIn) {
      activityMap[type].walkInCount += 1;
    } else {
      activityMap[type].onlineCount += 1;
    }
  });

  const activityBreakdown = Object.values(activityMap)
    .map((item) => ({
      ...item,
      sharePercent: totalPeriodRevenue > 0 ? Math.round((item.revenue / totalPeriodRevenue) * 100) : 0,
      avgPerSession: item.count > 0 ? Math.round(item.revenue / item.count) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 3. Peak Hours
  const peakHoursMap = Array.from({ length: 24 }, (_, hour) => {
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return {
      hour,
      label: `${hour12}:00 ${ampm}`,
      bookings: 0,
      revenue: 0
    };
  });

  periodBookings.forEach((b) => {
    const hour = new Date(b.startTime).getHours();
    if (peakHoursMap[hour]) {
      peakHoursMap[hour].bookings += 1;
      peakHoursMap[hour].revenue += b.totalPrice;
    }
  });

  // Filter only active peak hours with bookings > 0 or sort top 10
  const topPeakHours = [...peakHoursMap].sort((a, b) => b.bookings - a.bookings).filter(h => h.bookings > 0);

  // 4. Top Customers
  const topCustomers = allTimeCustomers
    .map((c) => {
      const bookingsCount = c.bookings.length;
      const totalSpent = c.bookings.reduce((sum, b) => sum + b.totalPrice, 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email || 'N/A',
        visits: bookingsCount,
        totalSpent
      };
    })
    .filter((c) => c.visits > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, 15);

  const dateFromStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dateToStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return {
    periodLabel,
    periodSlug,
    dateRangeStr: `${dateFromStr} to ${dateToStr}`,
    generatedAt: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    totalPeriodRevenue,
    totalPeriodBookings,
    totalOnlineRevenue,
    totalWalkInRevenue,
    dailyTrend,
    activityBreakdown,
    topPeakHours,
    topCustomers
  };
}

// 7. GET /api/analytics/export-pdf?period=daily|weekly|monthly -> Download Branded PDF Report
router.get('/export-pdf', async (req, res, next) => {
  try {
    const period = (req.query.period as string) || 'daily';
    const data = await getFullAnalyticsData(period);

    const todayDate = new Date().toISOString().split('T')[0];
    const filename = `ZeroOne-Analytics-${data.periodSlug}-${todayDate}.pdf`;

    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: `Analytics Report - ${data.periodLabel}`,
        Author: 'ZeroOne Cue & Play',
        Subject: 'Financial and Operational Performance Report'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Color Palette
    const COLOR_DARK = '#0b1b17';
    const COLOR_CARD = '#102621';
    const COLOR_TEXT = '#f3f4f6';
    const COLOR_MUTED = '#9ca3af';
    const COLOR_ACCENT = '#d4a94f'; // Brass Gold
    const COLOR_EMERALD = '#10b981';
    const COLOR_BORDER = '#1c4b42';
    const COLOR_ROW_ALT = '#132d27';

    // Background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR_DARK);

    // Header Gold Stripe
    doc.rect(0, 0, doc.page.width, 6).fill(COLOR_ACCENT);

    let currentY = 30;

    // Logo check
    let logoLoaded = false;
    try {
      const theme = await prisma.themeSettings.findFirst({
        where: {
          target: 'ADMIN',
          mode: 'DARK',
        },
      });
      const customLogo = theme?.logoUrlDark || theme?.logoUrlLight;
      if (customLogo) {
        const cleanPath = customLogo.replace(/^\//, '');
        const fullCustomLogoPath = path.join(process.cwd(), cleanPath);
        if (fs.existsSync(fullCustomLogoPath)) {
          doc.image(fullCustomLogoPath, 36, currentY, { width: 110 });
          logoLoaded = true;
        }
      }
    } catch (e) {}

    if (!logoLoaded) {
      doc.fillColor(COLOR_ACCENT).fontSize(16).font('Helvetica-Bold').text('ZEROONE CUE & PLAY', 36, currentY);
      doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text('EXECUTIVE ANALYTICS & REVENUE REPORT', 36, currentY + 18);
    }

    // Report Meta (Right Aligned)
    doc.fillColor(COLOR_TEXT).fontSize(13).font('Helvetica-Bold').text(`Performance Report`, doc.page.width - 240, currentY, { align: 'right', width: 204 });
    doc.fillColor(COLOR_ACCENT).fontSize(9.5).font('Helvetica-Bold').text(data.periodLabel, doc.page.width - 240, currentY + 16, { align: 'right', width: 204 });
    doc.fillColor(COLOR_MUTED).fontSize(8).font('Helvetica').text(`Range: ${data.dateRangeStr}`, doc.page.width - 240, currentY + 30, { align: 'right', width: 204 });
    doc.fillColor(COLOR_MUTED).fontSize(7.5).font('Helvetica').text(`Generated: ${data.generatedAt}`, doc.page.width - 240, currentY + 42, { align: 'right', width: 204 });

    currentY += 62;

    // Summary Stat Boxes (4 Columns)
    const boxWidth = (doc.page.width - 72 - 30) / 4;
    const boxHeight = 50;

    const stats = [
      { label: 'TOTAL REVENUE', value: `₨${data.totalPeriodRevenue.toLocaleString()}`, color: COLOR_EMERALD },
      { label: 'TOTAL SESSIONS', value: `${data.totalPeriodBookings}`, color: COLOR_TEXT },
      { label: 'WALK-IN REVENUE', value: `₨${data.totalWalkInRevenue.toLocaleString()}`, color: COLOR_ACCENT },
      { label: 'ONLINE REVENUE', value: `₨${data.totalOnlineRevenue.toLocaleString()}`, color: '#6366f1' }
    ];

    stats.forEach((st, idx) => {
      const boxX = 36 + idx * (boxWidth + 10);
      doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 6).fill(COLOR_CARD);
      doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 6).strokeColor(COLOR_BORDER).lineWidth(0.8).stroke();
      doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica-Bold').text(st.label, boxX + 8, currentY + 8);
      doc.fillColor(st.color).fontSize(13).font('Helvetica-Bold').text(st.value, boxX + 8, currentY + 24, { width: boxWidth - 16, ellipsis: true });
    });

    currentY += boxHeight + 18;

    // Section 1: Revenue Trend Table
    doc.fillColor(COLOR_ACCENT).fontSize(10).font('Helvetica-Bold').text('DAILY REVENUE & BOOKING TREND', 36, currentY);
    currentY += 16;

    const tableWidth = doc.page.width - 72;
    doc.rect(36, currentY, tableWidth, 20).fill(COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold');
    doc.text('DATE', 44, currentY + 5);
    doc.text('ONLINE (PKR)', 200, currentY + 5, { width: 90, align: 'right' });
    doc.text('WALK-IN (PKR)', 300, currentY + 5, { width: 90, align: 'right' });
    doc.text('TOTAL REVENUE', 400, currentY + 5, { width: 90, align: 'right' });
    doc.text('BOOKINGS', doc.page.width - 80, currentY + 5, { width: 40, align: 'right' });

    currentY += 20;

    // Render Trend Rows
    data.dailyTrend.forEach((row, idx) => {
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.rect(36, currentY, tableWidth, 16).fill(COLOR_ROW_ALT);
      }
      doc.fillColor(COLOR_TEXT).fontSize(7.5).font('Helvetica');
      doc.text(row.label, 44, currentY + 4);
      doc.fillColor(COLOR_MUTED).text(`₨${row.onlineRevenue.toLocaleString()}`, 200, currentY + 4, { width: 90, align: 'right' });
      doc.fillColor(COLOR_MUTED).text(`₨${row.walkInRevenue.toLocaleString()}`, 300, currentY + 4, { width: 90, align: 'right' });
      doc.fillColor(COLOR_EMERALD).font('Helvetica-Bold').text(`₨${row.revenue.toLocaleString()}`, 400, currentY + 4, { width: 90, align: 'right' });
      doc.fillColor(COLOR_TEXT).font('Helvetica').text(`${row.bookings}`, doc.page.width - 80, currentY + 4, { width: 40, align: 'right' });

      currentY += 16;
    });

    currentY += 14;

    // Section 2: Activity Breakdown Table
    doc.fillColor(COLOR_ACCENT).fontSize(10).font('Helvetica-Bold').text('ACTIVITY & ARENA PERFORMANCE BREAKDOWN', 36, currentY);
    currentY += 16;

    doc.rect(36, currentY, tableWidth, 20).fill(COLOR_BORDER);
    doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold');
    doc.text('ACTIVITY / ARENA', 44, currentY + 5);
    doc.text('SESSIONS', 220, currentY + 5, { width: 60, align: 'right' });
    doc.text('AVG / SESSION', 300, currentY + 5, { width: 80, align: 'right' });
    doc.text('TOTAL REVENUE', 390, currentY + 5, { width: 90, align: 'right' });
    doc.text('SHARE %', doc.page.width - 80, currentY + 5, { width: 40, align: 'right' });

    currentY += 20;

    data.activityBreakdown.forEach((act, idx) => {
      const isAlt = idx % 2 === 1;
      if (isAlt) {
        doc.rect(36, currentY, tableWidth, 16).fill(COLOR_ROW_ALT);
      }
      doc.fillColor(COLOR_TEXT).fontSize(7.5).font('Helvetica-Bold');
      doc.text(act.name, 44, currentY + 4);
      doc.fillColor(COLOR_TEXT).font('Helvetica').text(`${act.count}`, 220, currentY + 4, { width: 60, align: 'right' });
      doc.fillColor(COLOR_MUTED).text(`₨${act.avgPerSession.toLocaleString()}`, 300, currentY + 4, { width: 80, align: 'right' });
      doc.fillColor(COLOR_EMERALD).font('Helvetica-Bold').text(`₨${act.revenue.toLocaleString()}`, 390, currentY + 4, { width: 90, align: 'right' });
      doc.fillColor(COLOR_ACCENT).font('Helvetica-Bold').text(`${act.sharePercent}%`, doc.page.width - 80, currentY + 4, { width: 40, align: 'right' });

      currentY += 16;
    });

    currentY += 14;

    // Section 3: Top Customers (Condensed)
    if (data.topCustomers.length > 0 && currentY < doc.page.height - 120) {
      doc.fillColor(COLOR_ACCENT).fontSize(10).font('Helvetica-Bold').text('TOP PATRONS & CUSTOMERS (BY SPEND)', 36, currentY);
      currentY += 16;

      doc.rect(36, currentY, tableWidth, 18).fill(COLOR_BORDER);
      doc.fillColor(COLOR_TEXT).fontSize(8).font('Helvetica-Bold');
      doc.text('CUSTOMER', 44, currentY + 4);
      doc.text('PHONE', 220, currentY + 4);
      doc.text('VISITS', 370, currentY + 4, { width: 50, align: 'right' });
      doc.text('TOTAL SPENT', doc.page.width - 110, currentY + 4, { width: 70, align: 'right' });

      currentY += 18;

      data.topCustomers.slice(0, 5).forEach((cust, idx) => {
        const isAlt = idx % 2 === 1;
        if (isAlt) {
          doc.rect(36, currentY, tableWidth, 15).fill(COLOR_ROW_ALT);
        }
        doc.fillColor(COLOR_TEXT).fontSize(7.5).font('Helvetica-Bold').text(cust.name, 44, currentY + 3);
        doc.fillColor(COLOR_MUTED).font('Helvetica').text(cust.phone, 220, currentY + 3);
        doc.fillColor(COLOR_TEXT).text(`${cust.visits}`, 370, currentY + 3, { width: 50, align: 'right' });
        doc.fillColor(COLOR_EMERALD).font('Helvetica-Bold').text(`₨${cust.totalSpent.toLocaleString()}`, doc.page.width - 110, currentY + 3, { width: 70, align: 'right' });

        currentY += 15;
      });
    }

    // Footer
    const footerY = doc.page.height - 35;
    doc.moveTo(36, footerY).lineTo(doc.page.width - 36, footerY).strokeColor(COLOR_BORDER).lineWidth(0.5).stroke();
    doc.fillColor(COLOR_MUTED).fontSize(7).font('Helvetica').text(
      'ZeroOne Cue & Play  |  F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi  |  Confidential Business Report',
      36,
      footerY + 8,
      { align: 'center', width: doc.page.width - 72 }
    );

    doc.end();
  } catch (error) {
    console.error('Error generating analytics PDF:', error);
    next(error);
  }
});

// 8. GET /api/analytics/export-excel?period=daily|weekly|monthly -> Download Multi-Sheet Excel Workbook
router.get('/export-excel', async (req, res, next) => {
  try {
    const period = (req.query.period as string) || 'daily';
    const data = await getFullAnalyticsData(period);

    const todayDate = new Date().toISOString().split('T')[0];
    const filename = `ZeroOne-Analytics-${data.periodSlug}-${todayDate}.xlsx`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ZeroOne Cue & Play';
    workbook.created = new Date();

    // Common Header Stying
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B1B17' }
    };
    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFD4A94F' }
    };

    // SHEET 1: Summary
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 25 },
      { header: 'Notes', key: 'notes', width: 40 }
    ];
    summarySheet.getRow(1).fill = headerFill;
    summarySheet.getRow(1).font = headerFont;

    summarySheet.addRows([
      { metric: 'Report Title', value: `Analytics Report (${data.periodLabel})`, notes: `Date Range: ${data.dateRangeStr}` },
      { metric: 'Generated At', value: data.generatedAt, notes: 'System Export' },
      { metric: 'Total Revenue (PKR)', value: data.totalPeriodRevenue, notes: 'Confirmed + Completed Sessions' },
      { metric: 'Total Sessions Booked', value: data.totalPeriodBookings, notes: 'Combined Online and Walk-In' },
      { metric: 'Walk-In Counter Revenue', value: data.totalWalkInRevenue, notes: `${data.totalPeriodRevenue > 0 ? Math.round((data.totalWalkInRevenue / data.totalPeriodRevenue) * 100) : 0}% of total revenue` },
      { metric: 'Online Portal Revenue', value: data.totalOnlineRevenue, notes: `${data.totalPeriodRevenue > 0 ? Math.round((data.totalOnlineRevenue / data.totalPeriodRevenue) * 100) : 0}% of total revenue` }
    ]);
    summarySheet.getColumn('value').numFmt = '#,##0';

    // SHEET 2: Daily Revenue Trend
    const trendSheet = workbook.addWorksheet('Revenue Trend');
    trendSheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Day / Label', key: 'label', width: 20 },
      { header: 'Online Revenue (PKR)', key: 'onlineRevenue', width: 22 },
      { header: 'Walk-in Revenue (PKR)', key: 'walkInRevenue', width: 22 },
      { header: 'Total Revenue (PKR)', key: 'revenue', width: 22 },
      { header: 'Total Bookings', key: 'bookings', width: 16 }
    ];
    trendSheet.getRow(1).fill = headerFill;
    trendSheet.getRow(1).font = headerFont;

    data.dailyTrend.forEach((row) => {
      trendSheet.addRow({
        date: row.date,
        label: row.label,
        onlineRevenue: row.onlineRevenue,
        walkInRevenue: row.walkInRevenue,
        revenue: row.revenue,
        bookings: row.bookings
      });
    });

    // SHEET 3: Activity Breakdown
    const activitySheet = workbook.addWorksheet('Activity Breakdown');
    activitySheet.columns = [
      { header: 'Activity Arena', key: 'name', width: 25 },
      { header: 'Type Code', key: 'type', width: 18 },
      { header: 'Total Sessions', key: 'count', width: 16 },
      { header: 'Online Bookings', key: 'onlineCount', width: 16 },
      { header: 'Walk-in Bookings', key: 'walkInCount', width: 16 },
      { header: 'Avg / Session (PKR)', key: 'avgPerSession', width: 20 },
      { header: 'Total Revenue (PKR)', key: 'revenue', width: 22 },
      { header: 'Revenue Share %', key: 'sharePercent', width: 16 }
    ];
    activitySheet.getRow(1).fill = headerFill;
    activitySheet.getRow(1).font = headerFont;

    data.activityBreakdown.forEach((act) => {
      activitySheet.addRow({
        name: act.name,
        type: act.type,
        count: act.count,
        onlineCount: act.onlineCount,
        walkInCount: act.walkInCount,
        avgPerSession: act.avgPerSession,
        revenue: act.revenue,
        sharePercent: `${act.sharePercent}%`
      });
    });

    // SHEET 4: Top Customers
    const customerSheet = workbook.addWorksheet('Top Customers');
    customerSheet.columns = [
      { header: 'Customer Name', key: 'name', width: 25 },
      { header: 'Phone Number', key: 'phone', width: 18 },
      { header: 'Email Address', key: 'email', width: 28 },
      { header: 'Total Visits', key: 'visits', width: 14 },
      { header: 'Total Spend (PKR)', key: 'totalSpent', width: 20 }
    ];
    customerSheet.getRow(1).fill = headerFill;
    customerSheet.getRow(1).font = headerFont;

    data.topCustomers.forEach((c) => {
      customerSheet.addRow({
        name: c.name,
        phone: c.phone,
        email: c.email,
        visits: c.visits,
        totalSpent: c.totalSpent
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating analytics Excel report:', error);
    next(error);
  }
});

export { router as analyticsRouter };

