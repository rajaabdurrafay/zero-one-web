'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { getBookings, getActiveSessionsList, getReviews, type Booking, type LiveSession, type Review } from '@/lib/api';
import { playNotificationSound, playWarningSound, playAlarmSound } from '@/lib/sound';

const RESOURCE_LABELS: Record<string, string> = {
  SNOOKER: 'Snooker',
  PS5_OPEN: 'PS5 Open',
  PS5_PRIVATE: 'PS5 Private',
  CINEMA: 'Cinema',
  TABLE_TENNIS: 'Table Tennis',
  CAR_SIMULATOR: 'Car Simulator',
};

export function NotificationManager() {
  const router = useRouter();
  const isInitialBookingsMount = useRef(true);
  const isInitialVerificationsMount = useRef(true);
  const isInitialReviewsMount = useRef(true);
  const seenBookingIds = useRef<Set<string>>(new Set());
  const seenVerificationIds = useRef<Set<string>>(new Set());
  const seenReviewIds = useRef<Set<string>>(new Set());

  // Track session alerts so we only ring warning / alarm once per threshold
  const alertedWarningSessions = useRef<Set<string>>(new Set());
  const alertedTimeUpSessions = useRef<Set<string>>(new Set());

  // Poll active live sessions every 5s for time triggers
  const { data: activeSessions } = useSWR<LiveSession[]>(
    'zeroone-active-sessions',
    () => getActiveSessionsList(),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Poll recent bookings every 5 seconds (sorted by createdAt: desc)
  const { data: recentBookings } = useSWR<Booking[]>(
    'zeroone-recent-bookings',
    () => getBookings({ sortBy: 'createdAt', sortOrder: 'desc',limit:20 }),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Poll pending payment verifications every 5 seconds
  const { data: pendingVerifications } = useSWR<Booking[]>(
    'zeroone-pending-verifications',
    () => getBookings({ status: 'AWAITING_VERIFICATION', sortBy: 'paymentSubmittedAt', sortOrder: 'desc' }),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Poll pending reviews every 5 seconds
  const { data: pendingReviews } = useSWR<Review[]>(
    'zeroone-pending-reviews',
    () => getReviews('pending'),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Detect New Online / Walk-in Bookings
  useEffect(() => {
    if (!recentBookings || !Array.isArray(recentBookings)) return;

    if (isInitialBookingsMount.current) {
      console.log('[NotificationManager] Seeding initial bookings:', recentBookings.length);
      recentBookings.forEach((b) => seenBookingIds.current.add(b.id));
      isInitialBookingsMount.current = false;
      return;
    }

    recentBookings.forEach((b) => {
      if (!seenBookingIds.current.has(b.id)) {
        seenBookingIds.current.add(b.id);
        console.log('[NotificationManager] NEW BOOKING DETECTED:', b.id, b);
        playNotificationSound();

        const activity = b.resource?.type ? (RESOURCE_LABELS[b.resource.type] || b.resource.name) : (b.resource?.name || 'Arena');
        const customerName = b.customer?.name || 'Customer';

        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                router.push(`/bookings/${b.id}`);
              }}
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white dark:bg-[#0f2420] shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 dark:ring-white/10 border border-emerald-500/30 p-3.5 cursor-pointer hover:border-emerald-500 transition-all`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                    New Booking Received
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  New booking: <span className="font-bold text-[#1c4b42] dark:text-[#d4a94f]">{activity}</span> — {customerName}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Click to open booking details
                </p>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
      }
    });
  }, [recentBookings, router]);

  // Detect Payment Verifications Submitted (when customer uploads screenshot)
  useEffect(() => {
    if (!pendingVerifications || !Array.isArray(pendingVerifications)) return;

    if (isInitialVerificationsMount.current) {
      console.log('[NotificationManager] Seeding initial verifications:', pendingVerifications.length);
      pendingVerifications.forEach((b) => seenVerificationIds.current.add(b.id));
      isInitialVerificationsMount.current = false;
      return;
    }

    pendingVerifications.forEach((b) => {
      if (!seenVerificationIds.current.has(b.id)) {
        seenVerificationIds.current.add(b.id);
        console.log('[NotificationManager] NEW PAYMENT VERIFICATION DETECTED:', b.id, b);
        playNotificationSound();

        const customerName = b.customer?.name || 'Customer';

        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                router.push(`/bookings/${b.id}`);
              }}
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white dark:bg-[#0f2420] shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 dark:ring-white/10 border border-amber-500/30 p-3.5 cursor-pointer hover:border-amber-500 transition-all`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    Payment Verification Needed
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Payment verification needed: <span className="font-bold">{customerName}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Click to review payment receipt
                </p>
              </div>
            </div>
          ),
          { duration: 5000 }
        );
      }
    });
  }, [pendingVerifications, router]);

  // Detect New Customer Reviews Submitted (needing moderation)
  useEffect(() => {
    if (!pendingReviews || !Array.isArray(pendingReviews)) return;

    if (isInitialReviewsMount.current) {
      console.log('[NotificationManager] Seeding initial reviews:', pendingReviews.length);
      pendingReviews.forEach((r) => seenReviewIds.current.add(r.id));
      isInitialReviewsMount.current = false;
      return;
    }

    pendingReviews.forEach((r) => {
      if (!seenReviewIds.current.has(r.id)) {
        seenReviewIds.current.add(r.id);
        console.log('[NotificationManager] NEW REVIEW SUBMITTED:', r.id, r);
        playNotificationSound();

        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                router.push('/reviews');
              }}
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white dark:bg-[#0f2420] shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 dark:ring-white/10 border border-amber-500/40 p-3.5 cursor-pointer hover:border-amber-500 transition-all`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    New Review Submitted ⭐
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <span className="font-bold">{r.customerName}</span> left a {r.rating}-star review
                </p>
                <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                  Click to review and approve
                </p>
              </div>
            </div>
          ),
          { duration: 6000 }
        );
      }
    });
  }, [pendingReviews, router]);

  // Real-time local interval for live session alert triggers (5-min warning and time-up)
  useEffect(() => {
    if (!activeSessions || !Array.isArray(activeSessions) || activeSessions.length === 0) return;

    const checkTimers = () => {
      const now = Date.now();

      activeSessions.forEach((session) => {
        if (session.status !== 'RUNNING' || session.mode !== 'COUNTDOWN') return;

        const totalAllowedSeconds = ((session.plannedMinutes || 60) + session.extendedMinutes) * 60;
        const elapsedSeconds = Math.floor((now - new Date(session.startedAt).getTime()) / 1000) - session.totalPausedSeconds;
        const remainingSeconds = totalAllowedSeconds - elapsedSeconds;

        const resourceName = session.resource?.name || 'Active Station';
        const customerName = session.customerDisplay || session.booking?.customer?.name || session.customerName || 'Walk-in';

        // 5-Minute Warning Alert (300 seconds)
        if (remainingSeconds <= 300 && remainingSeconds > 0) {
          if (!alertedWarningSessions.current.has(session.id)) {
            alertedWarningSessions.current.add(session.id);
            playWarningSound();
            toast.custom(
              (t) => (
                <div
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push('/sessions');
                  }}
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-panel shadow-2xl rounded-2xl border-2 border-amber-500/80 p-4 cursor-pointer hover:border-amber-400 transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                      ⚠️
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
                          5 Minutes Remaining
                        </span>
                        <span className="text-[10px] font-mono font-bold text-muted bg-raised px-2 py-0.5 rounded">
                          {resourceName}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] font-bold text-text truncate">
                        {customerName} session ending shortly
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Click to view Live Sessions &amp; extend time if requested.
                      </p>
                    </div>
                  </div>
                </div>
              ),
              { duration: 7000 }
            );
          }
        }

        // Time's Up Alert (<= 0 seconds)
        if (remainingSeconds <= 0) {
          if (!alertedTimeUpSessions.current.has(session.id)) {
            alertedTimeUpSessions.current.add(session.id);
            playAlarmSound();
            toast.custom(
              (t) => (
                <div
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push('/sessions');
                  }}
                  className={`${
                    t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-panel shadow-2xl rounded-2xl border-2 border-rose-500 p-4 cursor-pointer hover:border-rose-400 transition-all`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 animate-pulse">
                      ⏰
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider animate-pulse">
                          Time is Up!
                        </span>
                        <span className="text-[10px] font-mono font-bold text-white bg-rose-600 px-2 py-0.5 rounded">
                          {resourceName}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] font-bold text-text truncate">
                        {customerName} time has completed
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Click to stop session and complete checkout billing.
                      </p>
                    </div>
                  </div>
                </div>
              ),
              { duration: 10000 }
            );
          }
        }
      });
    };

    checkTimers();
    const interval = setInterval(checkTimers, 1000);
    return () => clearInterval(interval);
  }, [activeSessions, router]);

  return null;
}
