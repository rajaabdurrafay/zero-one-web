const API_BASE = typeof window === 'undefined' ? (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') : '/api/backend';

function getClientAdminToken(): null { return null; }

export interface Activity {
  id: string;
  name: string;
  resourceType: string;
  pricingUnit: 'PER_MINUTE' | 'PER_HOUR';
  basePrice: number;
  halfHourPrice?: number | null;
  fullHourPrice?: number | null;
  createdAt: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  busySlots?: { bookingId: string; startTime: string; endTime: string }[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  profilePictureUrl?: string | null;
}

export type PaymentMethod = 'CASH' | 'ONLINE_JAZZCASH' | 'ONLINE_EASYPAISA' | 'ONLINE_BANK';

export interface Offer {
  id: string;
  title: string;
  description?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  applicableTo: 'ALL_ACTIVITIES' | 'SPECIFIC_ACTIVITY';
  activityId?: string | null;
  activity?: Activity | null;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  isVisibleOnWebsite: boolean;
  minDuration?: number | null;
  promoCode?: string | null;
  bannerImageUrl?: string | null;
  _count?: { bookings: number };
  createdAt: string;
  updatedAt: string;
}

export type BookingStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'AWAITING_VERIFICATION'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'COMPLETED';

export interface BookingGroup {
  id: string;
  customerId: string;
  totalAmount: number;
  status: BookingStatus;
  paymentMethod?: PaymentMethod | null;
  amountPaid?: number | null;
  paymentScreenshotUrl?: string | null;
  paymentSubmittedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  customer?: Customer;
  bookings?: Booking[];
  createdAt: string;
}

export interface BookingAddon {
  id: string;
  bookingId: string;
  addonItemId: string;
  quantity: number;
  priceAtBooking: number;
  addonItem?: AddonItem;
  createdAt?: string;
}

export interface Booking {
  id: string;
  bookingGroupId?: string | null;
  bookingGroup?: BookingGroup | null;
  resourceId: string;
  customerId: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalPrice: number;
  discountAmount?: number | null;
  appliedOfferId?: string | null;
  appliedOffer?: Offer | null;
  isWalkIn: boolean;
  paymentMethod?: PaymentMethod | null;
  amountPaid?: number | null;
  paymentScreenshotUrl?: string | null;
  paymentSubmittedAt?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  reminderSent?: boolean;
  addons?: BookingAddon[];
  resource: Resource;
  customer: Customer;
  createdAt: string;
  updatedAt?: string;
}

export interface AvailabilityResponse {
  date: string;
  resources: Resource[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getClientAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error: any = new Error(body.message || body.error || `API error: ${res.status}`);
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return res.json();
}

// Availability
export function getAvailability(date: string, resourceType?: string) {
  const params = new URLSearchParams({ date });
  if (resourceType) params.set('resourceType', resourceType);
  return apiFetch<AvailabilityResponse>(`/api/availability?${params}`);
}

// Bookings with Advanced Filter Options
export interface GetBookingsParams {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  resourceType?: string;
  bookingType?: 'online' | 'walkin' | 'both';
  search?: string;
  sortBy?: 'date' | 'amount' | 'customer' | 'paymentSubmittedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?:number;limit?:number;
}

export function getBookings(paramsOrDate?: string | GetBookingsParams, status?: string) {
  const query = new URLSearchParams();

  if (typeof paramsOrDate === 'string') {
    if (paramsOrDate) query.set('date', paramsOrDate);
    if (status) query.set('status', status);
  } else if (paramsOrDate && typeof paramsOrDate === 'object') {
    if(paramsOrDate.page)query.set('page',String(paramsOrDate.page));
    if(paramsOrDate.limit)query.set('limit',String(paramsOrDate.limit));
    if (paramsOrDate.date) query.set('date', paramsOrDate.date);
    if (paramsOrDate.dateFrom) query.set('dateFrom', paramsOrDate.dateFrom);
    if (paramsOrDate.dateTo) query.set('dateTo', paramsOrDate.dateTo);
    if (paramsOrDate.status) query.set('status', paramsOrDate.status);
    if (paramsOrDate.resourceType) query.set('resourceType', paramsOrDate.resourceType);
    if (paramsOrDate.bookingType && paramsOrDate.bookingType !== 'both') {
      query.set('bookingType', paramsOrDate.bookingType);
    }
    if (paramsOrDate.search) query.set('search', paramsOrDate.search);
    if (paramsOrDate.sortBy) query.set('sortBy', paramsOrDate.sortBy);
    if (paramsOrDate.sortOrder) query.set('sortOrder', paramsOrDate.sortOrder);
  } else if (status) {
    query.set('status', status);
  }

  const qs = query.toString();
  return apiFetch<Booking[]>(`/api/bookings${qs ? `?${qs}` : ''}`);
}

export function getBookingById(id: string) {
  return apiFetch<Booking>(`/api/bookings/${id}`);
}

export async function downloadBookingReceiptPdf(id: string): Promise<Blob> {
  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/bookings/${id}/receipt-pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to generate PDF receipt');
  }

  return res.blob();
}

export async function downloadGroupReceiptPdf(groupId: string): Promise<Blob> {
  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/bookings/group/${groupId}/receipt-pdf`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to generate group PDF receipt');
  }

  return res.blob();
}

export function createGroupBooking(data: {
  customer: { name: string; phone: string; email?: string };
  isWalkIn?: boolean;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  screenshotBase64?: string;
  items: Array<{
    resourceId: string;
    startTime: string;
    endTime: string;
    promoCode?: string | null;
    offerId?: string | null;
  }>;
  addons?: Array<{ addonItemId: string; quantity: number }>;
}) {
  return apiFetch<{
    group: BookingGroup;
    bookings: Booking[];
    totalAmount: number;
    customer: Customer;
  }>('/api/bookings/group', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyGroupBooking(groupId: string, data: {
  status: 'CONFIRMED' | 'REJECTED';
  rejectionReason?: string;
  amountPaid?: number;
}) {
  return apiFetch<BookingGroup>(`/api/bookings/group/${groupId}/verify`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function createBooking(data: {
  resourceId: string;
  customer: { name: string; phone: string; email?: string };
  startTime: string;
  endTime: string;
  isWalkIn?: boolean;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  screenshotBase64?: string;
  addons?: Array<{ addonItemId: string; quantity: number }>;
}) {
  return apiFetch<Booking>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateBooking(id: string, data: {
  status?: string;
  startTime?: string;
  endTime?: string;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  reminderSent?: boolean;
  verifiedAt?: string;
  rejectionReason?: string;
}) {
  return apiFetch<Booking>(`/api/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// Get Confirmed Bookings due for reminders in upcoming minutes
export function getRemindersDue(params?: { maxMinutes?: number; minMinutes?: number }) {
  const query = new URLSearchParams();
  if (params?.maxMinutes !== undefined) query.set('maxMinutes', String(params.maxMinutes));
  if (params?.minMinutes !== undefined) query.set('minMinutes', String(params.minMinutes));
  const queryString = query.toString();
  return apiFetch<Booking[]>(`/api/bookings/reminders-due${queryString ? `?${queryString}` : ''}`);
}

// Get Confirmed Bookings where reminderSent is true
export function getRemindersHistory(limit: number = 50) {
  return apiFetch<Booking[]>(`/api/bookings/reminders-history?limit=${limit}`);
}

// Pricing
export function getPricing() {
  return apiFetch<Activity[]>('/api/pricing');
}

export function updatePricing(id: string, data: {
  basePrice?: number;
  pricingUnit?: 'PER_MINUTE' | 'PER_HOUR';
  halfHourPrice?: number | null;
  fullHourPrice?: number | null;
}) {
  return apiFetch<Activity>(`/api/pricing/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface AnalyticsSummary {
  today: {
    revenue: number;
    bookings: number;
    confirmedBookings: number;
    revenueChangePct: number;
    bookingsChangePct: number;
  };
  week: {
    revenue: number;
    bookings: number;
    revenueChangePct: number;
  };
  month: {
    revenue: number;
    bookings: number;
    revenueChangePct: number;
  };
}

export interface RevenueTrendPoint {
  date: string;
  label: string;
  revenue: number;
  onlineRevenue: number;
  walkInRevenue: number;
  bookings: number;
}

export interface ActivityBreakdownItem {
  name: string;
  type: string;
  count: number;
  revenue: number;
  percentage: number;
  revenuePercentage: number;
}

export interface ActivityBreakdownResponse {
  breakdown: ActivityBreakdownItem[];
  totalRevenue: number;
  totalBookings: number;
}

export interface PeakHourPoint {
  hour: number;
  label: string;
  bookings: number;
  revenue: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  totalBookings: number;
  totalSpend: number;
  onlineCount: number;
  walkInCount: number;
}

export function getAnalyticsSummary() {
  return apiFetch<AnalyticsSummary>('/api/analytics/summary');
}

export interface RevenueByCategoryItem {
  activityName: string;
  resourceType: string;
  totalRevenue: number;
  totalBookings: number;
  onlineRevenue: number;
  walkInRevenue: number;
  avgRevenuePerBooking: number;
  percentOfTotal: number;
}

export interface RevenueByCategoryResponse {
  categories: RevenueByCategoryItem[];
  grandTotalRevenue: number;
  grandTotalBookings: number;
  topPerformer: RevenueByCategoryItem | null;
  lowestPerformer: RevenueByCategoryItem | null;
  period: string;
}

export function getRevenueTrend(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  return apiFetch<RevenueTrendPoint[]>(`/api/analytics/revenue?period=${period}`);
}



export function getRevenueByCategory(period: 'today' | 'week' | 'month' | 'all' = 'all') {
  return apiFetch<RevenueByCategoryResponse>(`/api/analytics/revenue-by-category?period=${period}`);
}

export function getActivityBreakdown() {
  return apiFetch<ActivityBreakdownResponse>('/api/analytics/activity-breakdown');
}

export function getPeakHours() {
  return apiFetch<PeakHourPoint[]>('/api/analytics/peak-hours');
}

export function getTopCustomers() {
  return apiFetch<TopCustomer[]>('/api/analytics/top-customers');
}

export async function downloadAnalyticsPdf(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<Blob> {
  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/analytics/export-pdf?period=${period}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download analytics PDF report');
  }

  return res.blob();
}

export async function downloadAnalyticsExcel(period: 'daily' | 'weekly' | 'monthly' = 'daily'): Promise<Blob> {
  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/analytics/export-excel?period=${period}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to download analytics Excel report');
  }

  return res.blob();
}

// Offers / Deals
export function getOffers(activeOnly?: boolean) {
  return apiFetch<Offer[]>(`/api/offers${activeOnly ? '?activeOnly=true' : ''}`);
}

export function createOffer(data: Partial<Offer>) {
  return apiFetch<Offer>('/api/offers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateOffer(id: string, data: Partial<Offer>) {
  return apiFetch<Offer>(`/api/offers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function toggleOfferActive(id: string) {
  return apiFetch<Offer>(`/api/offers/${id}/toggle`, {
    method: 'PATCH',
  });
}

export function toggleOfferVisibility(id: string) {
  return apiFetch<Offer>(`/api/offers/${id}/toggle-visibility`, {
    method: 'PATCH',
  });
}

export function deleteOffer(id: string) {
  return apiFetch<{ message: string }>(`/api/offers/${id}`, {
    method: 'DELETE',
  });
}

export interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  isRegistered: boolean;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string | null;
  daysInactive?: number | null;
  firstVisit: string | null;
  isVIP: boolean;
  vipTier: 'VIP' | 'LOYAL' | 'REGULAR';
  createdAt?: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  isRegistered: boolean;
  createdAt: string;
  stats: {
    totalVisits: number;
    totalSpent: number;
    avgSpendPerVisit: number;
    lastVisit: string | null;
    firstVisit: string | null;
    isVIP: boolean;
    vipTier: 'VIP' | 'LOYAL' | 'REGULAR';
    totalBookingsCount: number;
  };
  bookings: Array<{
    id: string;
    resourceId: string;
    resourceName: string;
    resourceType: string;
    startTime: string;
    endTime: string;
    status: string;
    totalPrice: number;
    discountAmount?: number | null;
    appliedOfferTitle?: string | null;
    isWalkIn: boolean;
    paymentMethod?: string | null;
    amountPaid?: number | null;
    createdAt: string;
  }>;
}

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
  category?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  customerName: string;
  customerAvatarUrl?: string | null;
  rating: number;
  reviewText: string;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  staffId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, any> | null;
  createdAt: string;
  staff: {
    id: string;
    name: string;
    username: string;
    role: string;
    avatarUrl?: string | null;
  };
}

export function getAuditLogs() {
  return apiFetch<AuditLog[]>('/api/audit-logs');
}

export interface AttendanceLog {
  id: string;
  adminUserId: string;
  loginAt: string;
  logoutAt: string | null;
  durationMinutes: number | null;
  date: string;
  adminUser: {
    id: string;
    name: string;
    username: string;
    role: string;
    avatarUrl?: string | null;
    lastLoginAt?: string | null;
  };
}

export function getAttendanceLogs(params?: { staffId?: string; startDate?: string; endDate?: string }) {
  const query = new URLSearchParams();
  if (params?.staffId) query.set('staffId', params.staffId);
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);

  const queryString = query.toString();
  return apiFetch<AttendanceLog[]>(`/api/admin/attendance${queryString ? `?${queryString}` : ''}`);
}

export function getActiveDutyStaff() {
  return apiFetch<AttendanceLog[]>('/api/admin/attendance/active-duty');
}

export interface AdminLoginSession {
  id: string;
  adminUserId: string;
  deviceFingerprint: string;
  ipAddress: string | null;
  userAgent: string | null;
  location: string | null;
  browser: string;
  os: string;
  firstSeenAt: string;
  lastSeenAt: string;
}

export function getAdminLoginSessions() {
  return apiFetch<AdminLoginSession[]>('/api/auth/admin/sessions');
}

export function revokeAdminLoginSession(sessionId: string) {
  return apiFetch<{ message: string }>(`/api/auth/admin/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function downloadFullBackup(): Promise<Blob> {
  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/admin/backup/full`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to download backup');
  }

  return res.blob();
}
export function getGallery() {
  return apiFetch<GalleryImage[]>('/api/gallery/admin');
}

export function uploadGalleryImage(data: {
  imageBase64: string;
  caption?: string;
  category?: string;
  displayOrder?: number;
  isActive?: boolean;
}) {
  return apiFetch<GalleryImage>('/api/gallery/admin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateGalleryImage(id: string, data: { caption?: string; category?: string; displayOrder?: number; isActive?: boolean }) {
  return apiFetch<GalleryImage>(`/api/gallery/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteGalleryImage(id: string) {
  return apiFetch<{ message: string }>(`/api/gallery/admin/${id}`, {
    method: 'DELETE',
  });
}

// Reviews API
export function getReviews(status?: 'pending' | 'approved') {
  const query = status ? `?status=${status}` : '';
  return apiFetch<Review[]>(`/api/reviews/admin${query}`);
}

export function createReviewManual(data: {
  customerName: string;
  rating: number;
  reviewText: string;
  isApproved?: boolean;
  isFeatured?: boolean;
  avatarBase64?: string;
}) {
  return apiFetch<Review>('/api/reviews/admin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateReview(id: string, data: {
  customerName?: string;
  rating?: number;
  reviewText?: string;
  isApproved?: boolean;
  isFeatured?: boolean;
  avatarBase64?: string;
}) {
  return apiFetch<Review>(`/api/reviews/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteReview(id: string) {
  return apiFetch<{message: string}>(`/api/reviews/admin/${id}`, {
    method: 'DELETE',
  });
}

// ---------------- Social Reels / Videos Management ----------------

export interface SocialReel {
  id: string;
  platform: string;
  url: string;
  thumbnailUrl: string;
  caption?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export function getAdminReels(): Promise<SocialReel[]> {
  return apiFetch<SocialReel[]>('/api/reels/admin');
}

export function addAdminReel(data: {
  platform?: string;
  url: string;
  thumbnailBase64?: string;
  thumbnailUrl?: string;
  caption?: string;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<SocialReel> {
  return apiFetch<SocialReel>('/api/reels/admin', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAdminReel(id: string, data: {
  platform?: string;
  url?: string;
  thumbnailBase64?: string;
  thumbnailUrl?: string;
  caption?: string;
  displayOrder?: number;
  isActive?: boolean;
}): Promise<SocialReel> {
  return apiFetch<SocialReel>(`/api/reels/admin/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminReel(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/reels/admin/${id}`, {
    method: 'DELETE',
  });
}

// Existing exports...
export function getCustomers(params?: {
  search?: string;
  sortBy?: 'totalSpent' | 'totalVisits' | 'lastVisit' | 'name';
  sortOrder?: 'asc' | 'desc';
  tier?: 'ALL' | 'VIP' | 'LOYAL' | 'REGISTERED' | 'CHURN_RISK' | string;
}): Promise<CustomerSummary[]> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params?.tier && params.tier !== 'ALL') query.set('tier', params.tier);
  const qs = query.toString();
  return apiFetch<CustomerSummary[]>(`/api/customers${qs ? `?${qs}` : ''}`);
}

export function getChurnRiskCustomers(params?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}): Promise<{ count: number; thresholdDays: number; customers: CustomerSummary[] }> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  const qs = query.toString();
  return apiFetch<{ count: number; thresholdDays: number; customers: CustomerSummary[] }>(
    `/api/admin/churn-risk${qs ? `?${qs}` : ''}`
  );
}

export function getCustomerById(id: string): Promise<CustomerDetail> {
  return apiFetch<CustomerDetail>(`/api/customers/${id}`);
}

export async function exportCustomersCsv(params?: {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  tier?: string;
}): Promise<Blob> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params?.tier && params.tier !== 'ALL') query.set('tier', params.tier);
  const qs = query.toString();

  const token = getClientAdminToken();
  const res = await fetch(`${API_BASE}/api/customers/export${qs ? `?${qs}` : ''}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    throw new Error('Failed to export customers CSV');
  }

  return res.blob();
}

export function adminResetCustomerPassword(customerId: string): Promise<{
  message: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  newPassword: string;
}> {
  return apiFetch(`/api/admin/customers/${customerId}/reset-password`, {
    method: 'POST',
  });
}

// ---------------- Theme Settings ----------------

export interface ThemeSettings {
  id?: string;
  target: 'WEBSITE' | 'ADMIN';
  mode?: 'LIGHT' | 'DARK';
  primaryColor: string;
  primaryDarkColor: string;
  accentColor: string;
  accentDarkColor: string;
  backgroundColor: string;
  textColor: string;
  displayFont: string;
  bodyFont: string;
  baseSizeScale: number;
  glassEffectEnabled?: boolean;
  logoUrlDark?: string | null;
  logoUrlLight?: string | null;
  updatedAt?: string;
  light?: ThemeSettings;
  dark?: ThemeSettings;
}

export function getTheme(target: 'WEBSITE' | 'ADMIN' = 'ADMIN', mode?: 'LIGHT' | 'DARK'): Promise<ThemeSettings> {
  const query = mode ? `target=${target}&mode=${mode}` : `target=${target}`;
  return apiFetch<ThemeSettings>(`/api/theme?${query}`).then(theme => {
    if (!theme || ['primaryColor', 'primaryDarkColor', 'accentColor', 'accentDarkColor', 'backgroundColor', 'textColor'].some(field => typeof (theme as unknown as Record<string, unknown>)[field] !== 'string' || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(String((theme as unknown as Record<string, unknown>)[field])))) throw new Error('Invalid theme response');
    return theme;
  }).catch(() => ({
    target,
    mode: mode || 'DARK',
    primaryColor: target === 'ADMIN' ? '#c9a84c' : '#8b5cf6',
    primaryDarkColor: target === 'ADMIN' ? '#e0c069' : '#6d28d9',
    accentColor: target === 'ADMIN' ? '#6366f1' : '#3b82f6',
    accentDarkColor: target === 'ADMIN' ? '#4338ca' : '#1d4ed8',
    backgroundColor: target === 'ADMIN' ? '#0b0b0c' : '#090d16',
    textColor: target === 'ADMIN' ? '#ededeb' : '#f8fafc',
    displayFont: target === 'ADMIN' ? 'Poppins' : 'Space Grotesk',
    bodyFont: 'Inter',
    baseSizeScale: 1.0,
    glassEffectEnabled: false,
    logoUrlDark: null,
    logoUrlLight: null,
  }));
}

export function updateTheme(data: ThemeSettings): Promise<{ message: string; theme: ThemeSettings }> {
  return apiFetch<{ message: string; theme: ThemeSettings }>('/api/theme', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function uploadThemeLogo(
  imageBase64: string,
  target: 'WEBSITE' | 'ADMIN',
  mode: 'DARK' | 'LIGHT'
): Promise<{ message: string; logoUrl: string }> {
  return apiFetch<{ message: string; logoUrl: string }>('/api/theme/upload-logo', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, target, mode }),
  });
}

// ---------------- Staff Management (Super Admin only) ----------------

export type AdminRole = 'SUPER_ADMIN' | 'MANAGER' | 'RECEPTIONIST';

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string | null;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export function getStaffMembers(): Promise<StaffMember[]> {
  return apiFetch<StaffMember[]>('/api/admin/staff');
}

export function createStaffMember(data: {
  name: string;
  username: string;
  password: string;
  role: AdminRole;
  avatarBase64?: string | null;
}): Promise<{ message: string; staff: StaffMember }> {
  return apiFetch<{ message: string; staff: StaffMember }>('/api/admin/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateStaffMember(
  id: string,
  data: {
    name?: string;
    username?: string;
    password?: string;
    role?: AdminRole;
    isActive?: boolean;
    avatarBase64?: string | null;
  }
): Promise<{ message: string; staff: StaffMember }> {
  return apiFetch<{ message: string; staff: StaffMember }>(`/api/admin/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteStaffMember(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/admin/staff/${id}`, {
    method: 'DELETE',
  });
}

export function getAdminMe(): Promise<{ user: StaffMember }> {
  return apiFetch<{ user: StaffMember }>('/api/auth/admin/me');
}

// ---------------- Contact Messages (Super Admin & Manager) ----------------

export interface ContactMessage {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  subject?: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetMessagesParams {
  status?: 'all' | 'unread' | 'read' | string;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortOrder?: 'asc' | 'desc';
}

export function getMessages(params?: GetMessagesParams): Promise<ContactMessage[]> {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') query.set('status', params.status);
  if (params?.isRead !== undefined) query.set('isRead', String(params.isRead));
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.search) query.set('search', params.search);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  const qs = query.toString();
  return apiFetch<ContactMessage[]>(`/api/admin/messages${qs ? `?${qs}` : ''}`);
}

export function getUnreadMessageCount(): Promise<{ unreadCount: number }> {
  return apiFetch<{ unreadCount: number }>('/api/admin/messages/unread-count').catch(() => ({ unreadCount: 0 }));
}

export function markMessageAsRead(id: string, isRead: boolean = true): Promise<{ success: boolean; data: ContactMessage }> {
  return apiFetch<{ success: boolean; data: ContactMessage }>(`/api/admin/messages/${id}/read`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead }),
  });
}

export function deleteMessage(id: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/admin/messages/${id}`, {
    method: 'DELETE',
  });
}

// ---------------- Site-Wide Popup Settings ----------------

export type PopupFrequency = 'ONCE_PER_SESSION' | 'EVERY_VISIT' | 'ONCE_PER_DAY';

export interface SitePopupSettings {
  id?: string;
  isEnabled: boolean;
  delaySeconds: number;
  frequency: PopupFrequency;
  heading: string;
  message: string;
  buttonText: string;
  buttonLink: string;
  imageUrl?: string | null;
  updatedAt?: string;
}

export function getAdminPopupSettings(): Promise<SitePopupSettings> {
  return apiFetch<SitePopupSettings>('/api/admin/popup-settings/admin').catch(() => ({
    isEnabled: false,
    delaySeconds: 4,
    frequency: 'ONCE_PER_SESSION',
    heading: 'Special Announcement',
    message: 'Check out our latest deals and book your gaming or snooker arena slot today!',
    buttonText: 'Book Your Slot',
    buttonLink: '/book',
    imageUrl: null,
  }));
}

export function updateAdminPopupSettings(data: Partial<SitePopupSettings>): Promise<{ message: string; popup: SitePopupSettings }> {
  return apiFetch<{ message: string; popup: SitePopupSettings }>('/api/admin/popup-settings/admin', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function uploadPopupImage(imageBase64: string, fileName?: string): Promise<{ message: string; imageUrl: string }> {
  return apiFetch<{ message: string; imageUrl: string }>('/api/admin/popup-settings/upload-image', {
    method: 'POST',
    body: JSON.stringify({ imageBase64, fileName }),
  });
}

// ---------------- System Controls & Operations Settings (Maintenance, Online Booking toggle) ----------------

export interface SystemSettings {
  id?: string;
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  bookingsEnabled: boolean;
  bookingsPausedMessage?: string | null;
  emergencyClosedToday: boolean;
  emergencyClosedMessage?: string | null;
  walkInsEnabled: boolean;
  contactPhone?: string | null;
  updatedAt?: string;
}

export function getAdminSystemSettings(): Promise<SystemSettings> {
  return apiFetch<SystemSettings>('/api/admin/system-settings/admin').catch(() => ({
    maintenanceMode: false,
    maintenanceMessage: 'We are currently undergoing scheduled maintenance. We will be back online shortly!',
    bookingsEnabled: true,
    bookingsPausedMessage: 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.',
    emergencyClosedToday: false,
    emergencyClosedMessage: 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.',
    walkInsEnabled: true,
    contactPhone: '+92 300 1234567',
  }));
}

export function updateAdminSystemSettings(data: Partial<SystemSettings>): Promise<{ message: string; settings: SystemSettings }> {
  return apiFetch<{ message: string; settings: SystemSettings }>('/api/admin/system-settings/admin', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function clearSystemCache(): Promise<{
  success: boolean;
  message: string;
  websiteRevalidated: boolean;
  timestamp: string;
}> {
  return apiFetch<{
    success: boolean;
    message: string;
    websiteRevalidated: boolean;
    timestamp: string;
  }>('/api/admin/system-settings/admin/clear-cache', {
    method: 'POST',
  });
}

// ---------------- Timeline View (Venue Calendar) ----------------

export interface TimelineBooking {
  id: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  totalPrice: number;
  isWalkIn: boolean;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
}

export interface TimelineResource {
  id: string;
  name: string;
  type: string;
  bookings: TimelineBooking[];
}

export interface TimelineResponse {
  date: string;
  serverTime: string;
  resources: TimelineResource[];
}

export function getTimelineData(date: string, resourceType?: string): Promise<TimelineResponse> {
  const query = new URLSearchParams({ date });
  if (resourceType) query.set('resourceType', resourceType);
  return apiFetch<TimelineResponse>(`/api/admin/timeline?${query.toString()}`);
}

// ---------------- Inventory / Addons (Café & Snack Items) ----------------

export interface AddonItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  stock?: number | null;
  isAvailable: boolean;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AddonStats {
  id: string;
  name: string;
  category?: string | null;
  price: number;
  stock?: number | null;
  isAvailable: boolean;
  totalQuantitySold: number;
  totalRevenueGenerated: number;
}

export interface AddonAnalyticsSummary {
  totalAddonRevenue: number;
  totalAddonUnits: number;
  topAddons: AddonStats[];
}

export function getAddons(all: boolean = true): Promise<AddonItem[]> {
  return apiFetch<AddonItem[]>(`/api/addons?all=${all}`);
}

export function getAddonById(id: string): Promise<AddonItem> {
  return apiFetch<AddonItem>(`/api/addons/${id}`);
}

export function createAddon(data: {
  name: string;
  description?: string | null;
  price: number;
  category?: string;
  stock?: number | null;
  isAvailable?: boolean;
  imageUrl?: string | null;
}): Promise<AddonItem> {
  return apiFetch<AddonItem>('/api/addons', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateAddon(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    price?: number;
    category?: string;
    stock?: number | null;
    isAvailable?: boolean;
    imageUrl?: string | null;
  }
): Promise<AddonItem> {
  return apiFetch<AddonItem>(`/api/addons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAddon(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/addons/${id}`, {
    method: 'DELETE',
  });
}

export function getTopAddons(): Promise<AddonAnalyticsSummary> {
  return apiFetch<AddonAnalyticsSummary>('/api/addons/top');
}

// ---------------- Live Sessions & Timer Hub ----------------

export type SessionMode = 'COUNTDOWN' | 'COUNT_UP';
export type SessionStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED';
export type SessionAction = 'START' | 'PAUSE' | 'RESUME' | 'EXTEND' | 'STOP';

export interface SessionLog {
  id: string;
  sessionId: string;
  action: SessionAction;
  performedByUserId: string;
  performedByUser?: {
    id: string;
    name: string;
  };
  details?: string | null;
  createdAt: string;
}

export interface LiveSession {
  pricingSnapshot?: import('@zeroone/domain').Snapshot | null;
  accruedAmount?: number | null;
  serverTime?: string;

  id: string;
  bookingId?: string | null;
  booking?: {
    id: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    amountPaid?:number|null;
    customer?: Customer;
    addons?: Array<{
      id: string;
      quantity: number;
      priceAtBooking: number;
      addonItem: AddonItem;
    }>;
  } | null;
  resourceId: string;
  resource?: Resource;
  customerName?: string | null;
  customerDisplay?: string;
  customerPhone?: string | null;
  mode: SessionMode;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string | null;
  plannedMinutes?: number | null;
  extendedMinutes: number;
  pausedAt?: string | null;
  totalPausedSeconds: number;
  finalAmount?: number | null;
  startedByUserId: string;
  startedByUser?: {
    id: string;
    name: string;
    username: string;
  };
  logs?: SessionLog[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceSessionMatrix {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  activeSession: LiveSession | null;
}

export function getLiveSessions(): Promise<ResourceSessionMatrix[]> {
  return apiFetch<ResourceSessionMatrix[]>('/api/admin/sessions');
}

export function getActiveSessionsList(): Promise<LiveSession[]> {
  return apiFetch<LiveSession[]>('/api/admin/sessions/active');
}

export function startLiveSession(data: {
  resourceId: string;
  bookingId?: string | null;
  customerName?: string | null;
  mode: SessionMode;
  plannedMinutes?: number | null;
}): Promise<LiveSession> {
  return apiFetch<LiveSession>('/api/admin/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateLiveSessionAction(
  sessionId: string,
  action: SessionAction,
  minutes?: number
): Promise<LiveSession> {
  return apiFetch<LiveSession>(`/api/admin/sessions/${sessionId}/action`, {
    method: 'PATCH',
    body: JSON.stringify({ action, minutes }),
  });
}

export function stopLiveSession(
  sessionId: string,
  paymentMethod: PaymentMethod = 'CASH',
  amountPaid?:number
): Promise<{
  message: string;
  session: LiveSession;
  totalElapsedMinutes: number;
  finalAmount: number;
}> {
  return apiFetch<{
    message: string;
    session: LiveSession;
    totalElapsedMinutes: number;
    finalAmount: number;
  }>(`/api/admin/sessions/${sessionId}/stop`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod,amountPaid }),
  });
}











export interface Page<T>{success:true;data:T[];meta:{pagination:{page:number;limit:number;total:number;totalPages:number}}}
export function getBookingsPage(params:GetBookingsParams):Promise<Page<Booking>>{
  const query=new URLSearchParams();for(const [key,value] of Object.entries(params))if(value!==undefined && value!=='' && value!=='both')query.set(key,String(value));
  return apiFetch<Page<Booking>>('/api/v1/bookings?'+query);
}

export function getSessionHistory():Promise<LiveSession[]>{return apiFetch<LiveSession[]>('/api/admin/sessions/history?limit=20');}
export function claimGuestBookings(guestId:string,accountId:string,verificationNote:string){return apiFetch<{claimedBookings:number}>('/api/admin/customers/'+guestId+'/claim-bookings',{method:'POST',body:JSON.stringify({accountId,verificationNote})});}
