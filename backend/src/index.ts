import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { availabilityRouter } from './routes/availability';
import { bookingsRouter } from './routes/bookings';
import { pricingRouter } from './routes/pricing';
import { analyticsRouter } from './routes/analytics';
import { offersRouter } from './routes/offers';
import { customerAuthRouter } from './routes/customerAuth';
import { adminAuthRouter } from './routes/adminAuth';
import { staffRouter } from './routes/staff';
import { messagesRouter } from './routes/messages';
import { adminCustomersRouter } from './routes/customers';
import { themeRouter } from './routes/theme';
import { popupRouter } from './routes/popup';
import { systemSettingsRouter } from './routes/systemSettings';
import { timelineRouter } from './routes/timeline';
import { addonsRouter } from './routes/addons';
import { sessionsRouter } from './routes/admin/sessions';
import { backupRouter } from './routes/admin/backup';
import { galleryRouter } from './routes/gallery';
import { reviewsRouter } from './routes/reviews';
import { reelsRouter } from './routes/reels';
import { auditLogsRouter } from './routes/auditLogs';
import { attendanceRouter } from './routes/attendance';
import { autoCompleteExpiredBookings, autoCancelExpiredPendingPayments } from './services/bookingAutomation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Public Payment / Setting details
app.get('/api/public-settings', (req, res) => {
  res.json({
    easypaisa: {
      number: process.env.PAYMENT_EASYPAISA_NO || '0312-3456789',
      title: process.env.PAYMENT_EASYPAISA_TITLE || 'Zero One Gaming Zone',
    },
    jazzcash: {
      number: process.env.PAYMENT_JAZZCASH_NO || '0300-1234567',
      title: process.env.PAYMENT_JAZZCASH_TITLE || 'Zero One Gaming Zone',
    },
    bank: {
      bankName: process.env.PAYMENT_BANK_NAME || 'Meezan Bank Ltd',
      accountNumber: process.env.PAYMENT_BANK_ACCOUNT || '01010101010101',
      iban: process.env.PAYMENT_BANK_IBAN || 'PK00MEZN0001010101010101',
      title: process.env.PAYMENT_BANK_TITLE || 'Zero One Gaming Lounge',
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth/admin', adminAuthRouter);
app.use('/api/auth', customerAuthRouter);
app.use('/api/admin/staff', staffRouter);
app.use('/api/contact', messagesRouter);
app.use('/api/admin/messages', messagesRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/pricing', pricingRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/offers', offersRouter);
app.use('/api/customers', adminCustomersRouter);
app.use('/api/admin/customers', adminCustomersRouter);
app.use('/api/admin/churn-risk', (req, res, next) => {
  req.url = '/churn-risk' + (req.url === '/' ? '' : req.url);
  adminCustomersRouter(req, res, next);
});
app.use('/api/theme', themeRouter);
app.use('/api/popup-settings', popupRouter);
app.use('/api/admin/popup-settings', popupRouter);
app.use('/api/system-settings', systemSettingsRouter);
app.use('/api/admin/system-settings', systemSettingsRouter);
app.use('/api/admin/timeline', timelineRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/addons', addonsRouter);
app.use('/api/admin/addons', addonsRouter);
app.use('/api/admin/sessions', sessionsRouter);
app.use('/api/admin/backup', backupRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/admin/gallery', galleryRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin/reviews', reviewsRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/admin/reels', reelsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/admin/audit-logs', auditLogsRouter);
app.use('/api/admin/attendance', attendanceRouter);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);

  // Database-changing background jobs require explicit opt-in.
  if (process.env.ENABLE_BOOKING_AUTOMATION !== 'true') {
    console.log('Booking automation disabled');
    return;
  }

  autoCompleteExpiredBookings();
  autoCancelExpiredPendingPayments();

  setInterval(() => {
    autoCompleteExpiredBookings();
    autoCancelExpiredPendingPayments();
  }, 30 * 1000);
});

