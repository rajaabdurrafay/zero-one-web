'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import {
  getMyBookings,
  cancelCustomerBooking,
  reuploadPaymentScreenshot,
  type BookingResponse,
  type MyBookingsResponse,
} from '@/lib/api';
import { formatDateReadable, formatDateTimeRange } from '@/lib/timeUtils';
import { Icon, type IconName } from '@/components/Icon';

const ACTIVITY_ICON_NAMES: Record<string, IconName> = {
  SNOOKER: 'snooker',
  PS5_OPEN: 'gamepad',
  PS5_PRIVATE: 'tv',
  CINEMA: 'clapperboard',
  TABLE_TENNIS: 'tableTennis',
  CAR_SIMULATOR: 'car',
};

interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function MyBookingsPage() {
  const router = useRouter();
  const { token, customer, logout, isLoading: authLoading } = useCustomerAuth();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [bookingsData, setBookingsData] = useState<MyBookingsResponse>({
    customer: {
      id: '',
      name: '',
      phone: '',
      email: null,
      isRegistered: false,
      createdAt: '',
    },
    upcoming: [],
    past: [],
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cancellation & Re-upload state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reuploadBooking, setReuploadBooking] = useState<BookingResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [reuploadSubmitting, setReuploadSubmitting] = useState(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Refs for tracking changes across silent background polls
  const previousStatusMapRef = useRef<Record<string, string>>({});
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!authLoading && !token) {
      router.push('/login');
    }
  }, [authLoading, token, router]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadData = useCallback(
    async (isSilent = false) => {
      if (!token) return;

      if (!isSilent) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const data = await getMyBookings(token);
        const upcoming = Array.isArray(data?.upcoming) ? data.upcoming : [];
        const past = Array.isArray(data?.past) ? data.past : [];
        const allBookings = [...upcoming, ...past];

        // Status change detection for live notifications
        if (!isFirstLoadRef.current) {
          for (const booking of allBookings) {
            const prevStatus = previousStatusMapRef.current[booking.id];
            if (prevStatus && prevStatus !== booking.status) {
              if (
                booking.status === 'CONFIRMED' &&
                (prevStatus === 'AWAITING_VERIFICATION' ||
                  prevStatus === 'PENDING' ||
                  prevStatus === 'PENDING_PAYMENT')
              ) {
                showToast(
                  `Your payment has been verified! Booking #${booking.id.slice(-6).toUpperCase()} for ${booking.resource.name} is now CONFIRMED.`,
                  'success'
                );
              } else if (booking.status === 'REJECTED' && prevStatus !== 'REJECTED') {
                showToast(
                  `Payment verification was rejected for #${booking.id.slice(-6).toUpperCase()}. Please re-upload screenshot.`,
                  'error'
                );
              } else if (booking.status === 'CANCELLED' && prevStatus !== 'CANCELLED') {
                showToast(
                  `Booking #${booking.id.slice(-6).toUpperCase()} was marked as CANCELLED.`,
                  'info'
                );
              }
            }
          }
        } else {
          isFirstLoadRef.current = false;
        }

        // Update status tracking map
        const newStatusMap: Record<string, string> = {};
        for (const b of allBookings) {
          newStatusMap[b.id] = b.status;
        }
        previousStatusMapRef.current = newStatusMap;

        setBookingsData({
          customer: data?.customer || {
            id: '',
            name: customer?.name || '',
            phone: customer?.phone || '',
            email: customer?.email || null,
            isRegistered: true,
            createdAt: '',
          },
          upcoming,
          past,
          total: typeof data?.total === 'number' ? data.total : 0,
        });
      } catch (err: any) {
        if (!isSilent) {
          setError(err.message || 'Failed to fetch bookings.');
        }
      } finally {
        if (!isSilent) {
          setLoading(false);
        } else {
          setTimeout(() => setIsRefreshing(false), 500);
        }
      }
    },
    [token, customer, showToast]
  );

  // Initial load & background auto-polling every 6 seconds
  useEffect(() => {
    if (!token) return;

    loadData(false);

    const interval = setInterval(() => {
      // Only poll when page tab is visible to conserve battery & network
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        loadData(true);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [token, loadData]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!token) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    setActionLoading(bookingId);
    try {
      await cancelCustomerBooking(bookingId, token);
      showToast('Booking cancelled successfully.', 'info');
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleReuploadSubmit = async () => {
    if (!token || !reuploadBooking || !filePreview) return;

    setReuploadSubmitting(true);
    try {
      await reuploadPaymentScreenshot(reuploadBooking.id, filePreview, token, selectedFile?.name);
      showToast('Payment screenshot re-submitted for verification!', 'success');
      setReuploadBooking(null);
      setSelectedFile(null);
      setFilePreview(null);
      await loadData(false);
    } catch (err: any) {
      alert(err.message || 'Failed to re-upload screenshot.');
    } finally {
      setReuploadSubmitting(false);
    }
  };

  if (authLoading || (!token && !bookingsData)) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-brand-text-muted">
        <span className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mr-3" />
        Checking account credentials...
      </div>
    );
  }

  const displayedBookings = activeTab === 'upcoming' ? bookingsData?.upcoming || [] : bookingsData?.past || [];

  return (
    <div className="zo-page-container zo-page-spacing space-y-8">
      {/* Real-time Toasts Stack */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-5 py-4 rounded-2xl shadow-2xl flex items-start justify-between gap-3 border backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300 ${
              t.type === 'success'
                ? 'bg-[#0f1d18]/95 border-emerald-500/50 text-emerald-200'
                : t.type === 'error'
                ? 'bg-[#220d11]/95 border-red-500/50 text-red-200'
                : 'bg-brand-surface/95 border-brand-primary/40 text-brand-text-main'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-lg">
                {t.type === 'success' ? (
                  <Icon name="check" size={18} className="text-emerald-400" />
                ) : t.type === 'error' ? (
                  <Icon name="alert" size={18} className="text-rose-400" />
                ) : (
                  <Icon name="bell" size={18} className="text-brand-primary" />
                )}
              </span>
              <p className="text-xs sm:text-sm font-semibold leading-relaxed">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-white/60 hover:text-white font-bold text-xs p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Account Header Banner */}
      <div className="bg-brand-surface border border-brand-border rounded-3xl zo-panel p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4 relative">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl zo-solid-accent bg-brand-primary flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-brand-primary/30">
            {customer?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="zo-inner-title text-xl sm:text-2xl font-black text-brand-text-main">{customer?.name}</h1>
              <span className="text-[10px] uppercase font-extrabold bg-brand-primary/20 text-brand-primary border border-brand-primary/30 px-2 py-0.5 rounded-full">
                Member
              </span>
            </div>
            <p className="text-xs sm:text-sm text-brand-text-muted font-mono mt-0.5">{customer?.phone}</p>
            {customer?.email && <p className="text-xs text-brand-text-muted/80">{customer?.email}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto relative">
          <Link
            href="/book"
            className="zo-action px-5 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl font-bold text-xs sm:text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-md shadow-brand-primary/30 transition-all"
          >
            + New Booking
          </Link>
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 min-h-[44px] flex items-center justify-center rounded-xl font-bold text-xs text-brand-text-muted hover:text-red-400 hover:bg-red-950/20 border border-brand-border hover:border-red-500/30 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs & Live Auto-Refresh Status Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'upcoming'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40 shadow-sm'
                : 'text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-transparent'
            }`}
          >
            Upcoming Reservations ({bookingsData?.upcoming.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('past')}
            className={`px-4 py-2 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'past'
                ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/40 shadow-sm'
                : 'text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-transparent'
            }`}
          >
            Past & Completed ({bookingsData?.past.length || 0})
          </button>
        </div>

        {/* Live Auto-Refresh indicator */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto mt-2 sm:mt-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-surface border border-brand-border text-[11px] font-medium text-brand-text-muted min-h-[44px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isRefreshing ? 'bg-brand-primary animate-ping' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span className="font-mono text-[10.5px]">
              {isRefreshing ? 'Syncing...' : 'Live auto-updates active'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => loadData(false)}
            disabled={loading}
            className="text-xs text-brand-text-muted hover:text-brand-text-main flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-lg hover:bg-brand-surface transition-colors cursor-pointer"
            title="Force refresh now"
          >
            <Icon name="refresh" size={14} className={loading ? 'animate-spin text-brand-primary' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Bookings List */}
      {loading ? (
        <div className="py-20 text-center text-brand-text-muted space-y-3">
          <span className="w-6 h-6 border-2 border-brand-primary border-t-transparent rounded-full animate-spin inline-block" />
          <p className="text-xs font-semibold">Loading your reservations...</p>
        </div>
      ) : displayedBookings.length === 0 ? (
        <div className="bg-brand-surface border border-brand-border rounded-3xl zo-panel p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-center mx-auto text-brand-text-muted">
            <Icon name="gamepad" size={24} />
          </div>
          <h3 className="text-lg font-bold text-brand-text-main">
            {activeTab === 'upcoming' ? 'No Upcoming Reservations' : 'No Past Reservations'}
          </h3>
          <p className="text-xs sm:text-sm text-brand-text-muted max-w-sm mx-auto">
            {activeTab === 'upcoming'
              ? 'You have no scheduled bookings right now. Pick an arena or lounge station and play today!'
              : 'Your completed and past bookings will show up here.'}
          </p>
          {activeTab === 'upcoming' && (
            <Link
              href="/book"
              className="zo-action inline-flex mt-2 px-6 py-3 min-h-[44px] items-center justify-center rounded-xl font-bold text-xs text-white zo-solid-accent bg-brand-primary shadow-md shadow-brand-primary/30"
            >
              Book a Slot Now →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedBookings.map((booking) => {
            const start = new Date(booking.startTime);
            const end = new Date(booking.endTime);
            const isConfirmed = booking.status === 'CONFIRMED';
            const isAwaiting = booking.status === 'AWAITING_VERIFICATION';
            const isPendingPayment = booking.status === 'PENDING_PAYMENT';
            const isRejected = booking.status === 'REJECTED';
            const isCancelled = booking.status === 'CANCELLED';
            const isCompleted = booking.status === 'COMPLETED';

            const canCancel = (isConfirmed || isAwaiting || isPendingPayment || isRejected) && start > new Date();
            const canReupload = isRejected || isAwaiting || isPendingPayment;

            return (
              <div
                key={booking.id}
                className={`bg-brand-surface border rounded-2xl p-5 sm:p-6 transition-all duration-300 ${
                  isRejected
                    ? 'border-red-500/50 bg-red-950/10 shadow-lg shadow-red-950/20'
                    : isAwaiting
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : isConfirmed
                    ? 'border-emerald-500/30'
                    : 'border-brand-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
                  <div className="flex items-center gap-3.5">
                    <span className="p-2.5 rounded-xl bg-brand-bg border border-brand-border text-brand-text-main flex items-center justify-center">
                      <Icon
                        name={ACTIVITY_ICON_NAMES[booking.resource.type] || 'gamepad'}
                        size={22}
                      />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base sm:text-lg font-black text-brand-text-main">
                          {booking.resource.name}
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-brand-text-muted bg-brand-bg px-2 py-0.5 rounded border border-brand-border">
                          #{booking.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-brand-text-muted mt-0.5">
                        {booking.resource.type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all ${
                        isConfirmed
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : isAwaiting
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : isRejected
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : isCancelled
                          ? 'bg-brand-bg text-brand-text-muted border border-brand-border'
                          : isCompleted
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                      }`}
                    >
                      {isAwaiting && <Icon name="clock" size={12} className="text-amber-400" />}
                      {isRejected && <Icon name="alert" size={12} className="text-red-400" />}
                      {isConfirmed && <Icon name="check" size={12} className="text-emerald-400" />}
                      {booking.status === 'AWAITING_VERIFICATION'
                        ? 'Under Admin Review'
                        : booking.status === 'PENDING_PAYMENT'
                        ? 'Pending Payment (15m Hold)'
                        : booking.status === 'REJECTED'
                        ? 'Payment Rejected'
                        : booking.status === 'CONFIRMED'
                        ? 'Confirmed'
                        : booking.status}
                    </span>
                  </div>
                </div>

                {/* Rejection Alert Box */}
                {isRejected && (
                  <div className="mt-4 p-3.5 bg-red-950/40 border border-red-500/50 rounded-xl flex items-start gap-2.5 text-xs text-red-200 animate-in fade-in">
                    <Icon name="alert" size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block text-red-300">Payment Verification Failed:</span>
                      <p className="text-red-200/90 mt-0.5">
                        {booking.rejectionReason || 'The uploaded payment screenshot could not be verified by our counter admin.'}
                      </p>
                      <span className="text-[11px] text-red-300/80 block mt-1 font-semibold">
                        Please re-upload a clear receipt screenshot or valid transaction proof below to keep your booking.
                      </span>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 text-xs">
                  <div className="bg-brand-bg p-3 rounded-xl border border-brand-border/70">
                    <span className="text-brand-text-muted block mb-0.5 uppercase tracking-wider text-[10px]">Date</span>
                    <span className="font-bold text-brand-text-main">{formatDateReadable(start)}</span>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-xl border border-brand-border/70">
                    <span className="text-brand-text-muted block mb-0.5 uppercase tracking-wider text-[10px]">Time</span>
                    <span className="font-bold text-emerald-400">{formatDateTimeRange(start, end)}</span>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-xl border border-brand-border/70">
                    <span className="text-brand-text-muted block mb-0.5 uppercase tracking-wider text-[10px]">Total Bill</span>
                    <span className="font-black text-brand-text-main text-sm">₨{booking.totalPrice.toLocaleString()}</span>
                  </div>
                  <div className="bg-brand-bg p-3 rounded-xl border border-brand-border/70">
                    <span className="text-brand-text-muted block mb-0.5 uppercase tracking-wider text-[10px]">Channel</span>
                    <span className="font-semibold text-brand-text-main/80">{booking.isWalkIn ? 'Counter Walk-In' : 'Online Website'}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] text-brand-text-muted">
                    Booked on {new Date(booking.createdAt).toLocaleDateString()}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Re-upload Proof Button */}
                    {canReupload && (
                      <button
                        type="button"
                        onClick={() => {
                          setReuploadBooking(booking);
                          setSelectedFile(null);
                          setFilePreview(null);
                        }}
                        className="zo-action px-3.5 py-1.5 min-h-[44px] rounded-xl text-xs font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-md shadow-brand-primary/30 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Icon name="camera" size={13} />
                        <span>{isRejected ? 'Re-upload Screenshot' : 'Update Payment Proof'}</span>
                      </button>
                    )}

                    {/* Self-Cancel Button */}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={actionLoading === booking.id}
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-3 py-1.5 min-h-[44px] rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center"
                      >
                        {actionLoading === booking.id ? 'Cancelling...' : 'Cancel Booking'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Re-upload Screenshot Modal */}
      {reuploadBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-brand-surface border border-brand-border rounded-3xl zo-panel max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div>
                <h3 className="text-lg font-black text-brand-text-main">Re-upload Payment Proof</h3>
                <p className="text-xs text-brand-text-muted">
                  Ref: #{reuploadBooking.id.slice(-8).toUpperCase()} • ₨{reuploadBooking.totalPrice.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReuploadBooking(null)}
                className="text-brand-text-muted hover:text-brand-text-main font-bold text-base cursor-pointer p-1 min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {reuploadBooking.rejectionReason && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200">
                <span className="font-bold text-red-300 block">Previous Rejection Reason:</span>
                {reuploadBooking.rejectionReason}
              </div>
            )}

            {/* File Upload Box */}
            <div className="relative border-2 border-dashed border-brand-border hover:border-brand-primary bg-brand-bg rounded-2xl p-6 text-center transition-all">
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />

              {filePreview ? (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={filePreview}
                    alt="New Proof Preview"
                    className="max-h-48 mx-auto rounded-xl object-contain border border-brand-border"
                  />
                  <span className="text-xs font-semibold text-emerald-400 block">
                    Selected: {selectedFile?.name} (Click to change)
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-brand-surface border border-brand-border flex items-center justify-center mx-auto text-brand-text-muted">
                    <Icon name="camera" size={20} />
                  </div>
                  <span className="text-xs font-bold text-brand-text-main block">
                    Choose new payment screenshot
                  </span>
                  <span className="text-[10px] text-brand-text-muted block">PNG, JPG up to 5MB</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setReuploadBooking(null)}
                className="px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold text-brand-text-muted hover:text-brand-text-main bg-brand-bg cursor-pointer flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!filePreview || reuploadSubmitting}
                onClick={handleReuploadSubmit}
                className="zo-action px-6 py-2.5 min-h-[44px] rounded-xl text-xs font-black text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/30 transition-all flex items-center gap-2 cursor-pointer"
              >
                {reuploadSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit for Review</span>
                    <Icon name="check" size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

