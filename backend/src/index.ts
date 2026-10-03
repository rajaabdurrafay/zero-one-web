import {versionedApi} from './middleware/apiContract';
import {publicCache} from './middleware/publicCache';
import {validateQueries} from './middleware/queryValidation';
import {z} from 'zod';
// Business date boundaries are Karachi, independent of the host OS timezone.
process.env.TZ='Asia/Karachi';
import 'dotenv/config';
import helmet from 'helmet';
import compression from 'compression';
import { apiLimiter, authLimiter, submissionLimiter, validateImageUploads } from './middleware/security';
import { validateAuthConfiguration, signPaymentImage, verifyPaymentImage } from './utils/auth';
import { prisma } from './db';
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
import { publicStatsRouter } from './routes/publicStats';
import { reelsRouter } from './routes/reels';
import { auditLogsRouter } from './routes/auditLogs';
import { attendanceRouter } from './routes/attendance';
import { autoCompleteExpiredBookings, autoCancelExpiredPendingPayments } from './services/bookingAutomation';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 3001;

validateAuthConfiguration();
app.disable('x-powered-by');
app.use(versionedApi);
app.use(validateQueries);
// Configure exact proxy addresses/subnets at deployment; never trust arbitrary forwarding headers.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));
const allowedOrigins = (process.env.CORS_ORIGINS || [process.env.WEBSITE_URL, process.env.ADMIN_URL, ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3002'] : [])].filter(Boolean).join(',')).split(',').map(origin => origin.trim()).filter(Boolean);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) throw new Error('Configure CORS_ORIGINS or WEBSITE_URL/ADMIN_URL in production.');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(Object.assign(new Error('Origin not allowed.'), { status: 403 }));
} }));
app.use('/api', apiLimiter);
for (const route of ['/api/auth/login', '/api/auth/admin/login', '/api/auth/signup', '/api/auth/forgot-password', '/api/auth/reset-password']) app.use(route, authLimiter);
for (const route of ['/api/contact', '/api/reviews', '/api/bookings']) app.use(route, submissionLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(validateImageUploads);
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

// Payment evidence is private: authorized API responses mint short-lived image URLs.
app.use('/api', (_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body: any) => {
    const visit = (value: any): void => {
      if (!value || typeof value !== 'object' || value instanceof Date) return;
      if (typeof value.paymentScreenshotUrl === 'string' && value.paymentScreenshotUrl.startsWith('/uploads/')) value.paymentScreenshotUrl = signPaymentImage(value.paymentScreenshotUrl);
      for (const child of Object.values(value)) visit(child);
    };
    visit(body); return json(body);
  };
  next();
});
app.use('/uploads', (req, res, next) => {
  if (/^\/(?:payment_|grp_payment_|reupload_|pos_)/.test(req.path)) {
    if (typeof req.query.access !== 'string' || !verifyPaymentImage(req.query.access, '/uploads' + req.path)) return res.status(401).json({ error: 'Payment image authentication required.' });
    res.setHeader('Cache-Control', 'private, no-store');
  }
  next();
});
// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), { dotfiles: 'deny', index: false, maxAge: '1d', setHeaders: res => { res.setHeader('X-Content-Type-Options', 'nosniff'); if (/^(?:payment_|grp_payment_|reupload_|pos_)/.test(path.basename(res.req.path))) res.setHeader('Cache-Control', 'private, no-store'); } }));

app.use('/api',publicCache);

// Public Payment / Setting details
app.get('/api/public-settings', (req, res) => {
  res.json({
    easypaisa: {
      number: process.env.PAYMENT_EASYPAISA_NO || '',
      title: process.env.PAYMENT_EASYPAISA_TITLE || '',
    },
    jazzcash: {
      number: process.env.PAYMENT_JAZZCASH_NO || '',
      title: process.env.PAYMENT_JAZZCASH_TITLE || '',
    },
    bank: {
      bankName: process.env.PAYMENT_BANK_NAME || '',
      accountNumber: process.env.PAYMENT_BANK_ACCOUNT || '',
      iban: process.env.PAYMENT_BANK_IBAN || '',
      title: process.env.PAYMENT_BANK_TITLE || '',
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
app.use('/api/public-stats', publicStatsRouter);
app.use('/api/admin/reviews', reviewsRouter);
app.use('/api/reels', reelsRouter);
app.use('/api/admin/reels', reelsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/admin/audit-logs', auditLogsRouter);
app.use('/api/admin/attendance', attendanceRouter);

app.use((_req, res) => { res.status(404).json({ error: 'Route not found.' }); });
// Do not return SQL, filesystem paths or stack traces to production clients.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  if(err instanceof z.ZodError)return void res.status(400).json({error:'Invalid input',details:err.errors});
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
  console.error('[API error]', req.method, req.path, err.message);
  res.status(status).json({ error: status >= 500 ? 'Internal Server Error' : status === 413 ? 'Request body exceeds size limit.' : err.message || 'Invalid request.' });
});

if (require.main === module) {
let automationRunning = false;
async function runAutomation() {
  if (automationRunning) return;
  automationRunning = true;
  try { await autoCompleteExpiredBookings(); await autoCancelExpiredPendingPayments(); }
  finally { automationRunning = false; }
}
let timer: NodeJS.Timeout | undefined;
const server = app.listen(Number(PORT), process.env.HOST || '0.0.0.0', () => {
  console.log('Server listening on port ' + PORT);
  void runAutomation();
  timer = setInterval(() => { void runAutomation(); }, 30_000);
  timer.unref();
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  if (timer) clearInterval(timer);
  const deadline = setTimeout(() => { process.exit(1); }, 10_000); deadline.unref();
  server.close(() => { void prisma.$disconnect().finally(() => { clearTimeout(deadline); process.exit(0); }); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

}
