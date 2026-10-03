const API_BASE = typeof window === 'undefined' ? (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') : '/api/backend';

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
  isVisibleOnWebsite?: boolean;
  minDuration?: number | null;
  promoCode?: string | null;
  bannerImageUrl?: string | null;
}

export interface ValidatePromoResponse {
  valid: boolean;
  offer?: Offer;
  error?: string;
}

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

export interface ResourceAvailability {
  id: string;
  name: string;
  type: string;
  busySlots: {
    bookingId: string;
    startTime: string;
    endTime: string;
  }[];
}

export interface AvailabilityResponse {
  date: string;
  serverTime: string;
  resources: ResourceAvailability[];
}

export interface BookingCustomer {
  name: string;
  phone: string;
  email?: string;
}

export interface CreateBookingPayload {
  resourceId: string;
  customer: BookingCustomer;
  startTime: string;
  endTime: string;
  isWalkIn?: boolean;
  promoCode?: string;
  offerId?: string;
  addons?: Array<{ addonItemId: string; quantity: number }>;
}

export type PaymentMethod = 'CASH' | 'ONLINE_JAZZCASH' | 'ONLINE_EASYPAISA' | 'ONLINE_BANK';

export type BookingStatus =
  | 'PENDING'
  | 'PENDING_PAYMENT'
  | 'AWAITING_VERIFICATION'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'COMPLETED';

export interface BookingAddon {
  id: string;
  bookingId: string;
  addonItemId: string;
  quantity: number;
  priceAtBooking: number;
  addonItem?: AddonItem;
}

export interface BookingResponse {
  accessToken?: string;
  id: string;
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
  addons?: BookingAddon[];
  resource: {
    id: string;
    name: string;
    type: string;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string;
  };
  createdAt: string;
}

export interface PublicPaymentSettings {
  easypaisa: {
    number: string;
    title: string;
  };
  jazzcash: {
    number: string;
    title: string;
  };
  bank: {
    bankName: string;
    accountNumber: string;
    iban: string;
    title: string;
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  const bookingMatch = path.match(/^\/api\/bookings\/(?:group\/)?([^/?]+)/);
  if (bookingMatch && typeof window !== 'undefined') {
    const access = sessionStorage.getItem('zeroone-booking-' + bookingMatch[1]);
    if (access) headers.set('x-booking-token', access);
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

  const result = await res.json();
  if (typeof window !== 'undefined') {
    for (const booking of [result, result.group, ...(Array.isArray(result.bookings) ? result.bookings : [])]) {
      if (booking?.id && booking.accessToken) sessionStorage.setItem('zeroone-booking-' + booking.id, booking.accessToken);
    }
  }
  return result;
}

export function getPricing(): Promise<Activity[]> {
  return apiFetch<Activity[]>('/api/pricing');
}

export function getPublicPaymentSettings(): Promise<PublicPaymentSettings> {
  return apiFetch<PublicPaymentSettings>('/api/public-settings');
}

export function getActiveOffers(): Promise<Offer[]> {
  return apiFetch<Offer[]>('/api/offers/active');
}

export function validatePromoCode(data: {
  promoCode: string;
  activityId?: string;
  durationMinutes?: number;
}): Promise<ValidatePromoResponse> {
  return apiFetch<ValidatePromoResponse>('/api/offers/validate-code', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getAvailability(date: string, resourceType?: string): Promise<AvailabilityResponse> {
  const params = new URLSearchParams({ date });
  if (resourceType) params.set('resourceType', resourceType);
  return apiFetch<AvailabilityResponse>(`/api/availability?${params.toString()}`);
}

export interface GroupBookingItemPayload {
  resourceId: string;
  startTime: string;
  endTime: string;
  promoCode?: string | null;
  offerId?: string | null;
}

export interface CreateGroupBookingPayload {
  customer: BookingCustomer;
  isWalkIn?: boolean;
  paymentMethod?: PaymentMethod;
  amountPaid?: number;
  screenshotBase64?: string;
  items: GroupBookingItemPayload[];
  addons?: Array<{ addonItemId: string; quantity: number }>;
}

export interface BookingGroupResponse {
  accessToken?: string;
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
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
  bookings: BookingResponse[];
  createdAt: string;
}

export interface CreateGroupBookingResponse {
  group: BookingGroupResponse;
  bookings: BookingResponse[];
  totalAmount: number;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
}

export function createBooking(payload: CreateBookingPayload, token?: string | null): Promise<BookingResponse> {
  return apiFetch<BookingResponse>('/api/bookings', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  });
}

export function createGroupBooking(payload: CreateGroupBookingPayload, token?: string | null): Promise<CreateGroupBookingResponse> {
  return apiFetch<CreateGroupBookingResponse>('/api/bookings/group', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify(payload),
  });
}

export function getGroupBooking(groupId: string): Promise<BookingGroupResponse> {
  return apiFetch<BookingGroupResponse>(`/api/bookings/group/${groupId}`);
}

export function uploadGroupPaymentScreenshot(
  groupId: string,
  screenshotBase64: string,
  fileName?: string,
  paymentMethod?: PaymentMethod,
  amountPaid?: number
): Promise<BookingGroupResponse> {
  return apiFetch<BookingGroupResponse>(`/api/bookings/group/${groupId}/upload-payment`, {
    method: 'POST',
    body: JSON.stringify({ screenshotBase64, fileName, paymentMethod, amountPaid }),
  });
}

export function uploadPaymentScreenshot(
  bookingId: string,
  screenshotBase64: string,
  fileName?: string,
  paymentMethod?: PaymentMethod,
  amountPaid?: number
): Promise<BookingResponse> {
  return apiFetch<BookingResponse>(`/api/bookings/${bookingId}/upload-payment`, {
    method: 'POST',
    body: JSON.stringify({ screenshotBase64, fileName, paymentMethod, amountPaid }),
  });
}

// ---------------- Customer Auth & My Bookings ----------------

export interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  isRegistered: boolean;
}

export interface CustomerAuthResponse {
  message: string;
  token: string;
  customer: CustomerUser;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  profilePictureUrl?: string | null;
  isRegistered: boolean;
  createdAt: string;
  _count?: {
    bookings: number;
  };
}

export interface MyBookingsResponse {
  customer: CustomerProfile;
  upcoming: BookingResponse[];
  past: BookingResponse[];
  total: number;
}

export function customerSignup(data: {
  name: string;
  phone: string;
  password: string;
  email?: string;
}): Promise<CustomerAuthResponse> {
  return apiFetch<CustomerAuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function customerLogin(data: {
  phone: string;
  password: string;
}): Promise<CustomerAuthResponse> {
  return apiFetch<CustomerAuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getCustomerProfile(token: string): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function getMyBookings(token: string): Promise<MyBookingsResponse> {
  return apiFetch<MyBookingsResponse>('/api/bookings/my-bookings', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function cancelCustomerBooking(bookingId: string, token: string): Promise<{ message: string; booking: BookingResponse }> {
  return apiFetch<{ message: string; booking: BookingResponse }>(`/api/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function reuploadPaymentScreenshot(
  bookingId: string,
  screenshotBase64: string,
  token: string,
  fileName?: string
): Promise<{ message: string; booking: BookingResponse }> {
  return apiFetch<{ message: string; booking: BookingResponse }>(`/api/bookings/${bookingId}/reupload-payment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ screenshotBase64, fileName }),
  });
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function uploadProfilePicture(
  photoBase64: string,
  token: string
): Promise<{ message: string; profilePictureUrl: string; customer: CustomerUser }> {
  return apiFetch<{ message: string; profilePictureUrl: string; customer: CustomerUser }>('/api/auth/profile-picture', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ photoBase64 }),
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

// ---------------- System / Maintenance Settings ----------------

export interface SystemSettingsPublic {
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  bookingsEnabled: boolean;
  bookingsPausedMessage?: string | null;
  emergencyClosedToday: boolean;
  emergencyClosedMessage?: string | null;
  contactPhone?: string | null;
  updatedAt?: string;
}

export function getSystemSettings(): Promise<SystemSettingsPublic> {
  return apiFetch<SystemSettingsPublic>('/api/system-settings').catch(() => ({
    maintenanceMode: false,
    maintenanceMessage: 'We are currently undergoing scheduled maintenance. We will be back online shortly!',
    bookingsEnabled: true,
    bookingsPausedMessage: 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.',
    emergencyClosedToday: false,
    emergencyClosedMessage: 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.',
    contactPhone: '+92 300 1234567',
  }));
}

// ---------------- Social Reels ----------------

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

export function getPublicReels(): Promise<SocialReel[]> {
  return apiFetch<SocialReel[]>('/api/reels');
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

export function getTheme(target: 'WEBSITE' | 'ADMIN' = 'WEBSITE', mode?: 'LIGHT' | 'DARK'): Promise<ThemeSettings> {
  const query = mode ? `target=${target}&mode=${mode}` : `target=${target}`;
  return apiFetch<ThemeSettings>(`/api/theme?${query}`).then(theme => {
    if (!theme || ['primaryColor', 'primaryDarkColor', 'accentColor', 'accentDarkColor', 'backgroundColor', 'textColor'].some(field => typeof (theme as unknown as Record<string, unknown>)[field] !== 'string' || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(String((theme as unknown as Record<string, unknown>)[field])))) throw new Error('Invalid theme response');
    return theme;
  }).catch(() => ({
    target: 'WEBSITE',
    mode: mode || 'DARK',
    primaryColor: '#8b5cf6',
    primaryDarkColor: '#6d28d9',
    accentColor: '#3b82f6',
    accentDarkColor: '#1d4ed8',
    backgroundColor: '#090d16',
    textColor: '#f8fafc',
    displayFont: 'Space Grotesk',
    bodyFont: 'Inter',
    baseSizeScale: 1.0,
    glassEffectEnabled: false,
    logoUrlDark: null,
    logoUrlLight: null,
  }));
}

// ---------------- Addons / Café Items ----------------

export interface AddonItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  stock?: number | null;
  isAvailable: boolean;
  imageUrl?: string | null;
}

export function getAddons(): Promise<AddonItem[]> {
  return apiFetch<AddonItem[]>('/api/addons');
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

export function getPopupSettings(): Promise<SitePopupSettings> {
  return apiFetch<SitePopupSettings>('/api/popup-settings').catch(() => ({
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

// ---------------- Photo Gallery ----------------

export interface GalleryImage {
  id: string;
  imageUrl: string;
  caption?: string | null;
  category?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export function getPublicGallery(): Promise<GalleryImage[]> {
  return apiFetch<GalleryImage[]>('/api/gallery').catch(() => []);
}

// ---------------- Customer Reviews ----------------

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

export interface ReviewsResponse {
  reviews: Review[];
  stats: {
    totalReviews: number;
    averageRating: number;
  };
}

export function getPublicReviews(params?: { featured?: boolean; limit?: number }): Promise<ReviewsResponse> {
  const query = new URLSearchParams();
  if (params?.featured) query.set('featured', 'true');
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<ReviewsResponse>(`/api/reviews${qs ? `?${qs}` : ''}`).catch(() => ({
    reviews: [],
    stats: { totalReviews: 0, averageRating: 5.0 }
  }));
}

export function submitPublicReview(data: {
  customerName: string;
  customerAvatarUrl?: string | null;
  rating: number;
  reviewText: string;
}): Promise<{ message: string; review: Review }> {
  return apiFetch<{ message: string; review: Review }>('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
