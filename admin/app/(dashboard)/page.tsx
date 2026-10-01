'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { getBookings, getAvailability, getRemindersDue, getActiveSessionsList, getChurnRiskCustomers, getActiveDutyStaff, updateBooking, type Booking, type Resource, type LiveSession, type AttendanceLog } from '@/lib/api';
import { playNotificationSound } from '@/lib/sound';
import { formatDateReadable, formatTime12h } from '@/lib/timeUtils';
import { generateWhatsAppBookingUrl, generateWhatsAppReminderUrl } from '@/lib/whatsapp';
import { Icon } from '@/components/Icon';

const RESOURCE_TYPES = ['SNOOKER', 'PS5_OPEN', 'PS5_PRIVATE', 'CINEMA', 'TABLE_TENNIS', 'CAR_SIMULATOR'];
const RESOURCE_LABELS: Record<string, string> = {
  SNOOKER: 'Snooker',
  PS5_OPEN: 'PS5 Open',
  PS5_PRIVATE: 'PS5 Private',
  CINEMA: 'Cinema',
  TABLE_TENNIS: 'Table Tennis',
  CAR_SIMULATOR: 'Car Simulator',
};

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: 'pill-live',
  COMPLETED: 'pill-info',
  CANCELLED: 'pill-stop',
  EXPIRED: 'pill-neutral',
};

export default function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeProofUrl, setActiveProofUrl] = useState<string | null>(null);

  const swrOpts = { refreshInterval: 5000, revalidateOnFocus: true, dedupingInterval: 2000 };

  const {
    data: todayBookings,
    error: todayBookingsError,
    mutate: mutateToday,
  } = useSWR<Booking[]>(['dashboard-today-bookings', today], () => getBookings(today), swrOpts);

  const {
    data: pendingVerificationData,
    error: pendingError,
    mutate: mutatePending,
  } = useSWR<Booking[]>(
    ['dashboard-pending-verifications'],
    () => getBookings({ status: 'AWAITING_VERIFICATION', sortBy: 'paymentSubmittedAt', sortOrder: 'asc' }),
    swrOpts
  );

  const {
    data: remindersDueData,
    error: remindersError,
    mutate: mutateReminders,
  } = useSWR<Booking[]>(
    ['dashboard-reminders-due'],
    () => getRemindersDue(),
    swrOpts
  );

  const {
    data: allRecentBookings,
    error: recentError,
    isLoading: recentLoading,
    mutate: mutateRecent,
  } = useSWR<Booking[]>(['dashboard-recent-bookings'], () => getBookings(), swrOpts);

  const {
    data: activeSessions,
    error: sessionsError,
  } = useSWR<LiveSession[]>('dashboard-active-sessions', () => getActiveSessionsList(), swrOpts);

  const { data: staffOnDuty } = useSWR<AttendanceLog[]>(
    'dashboard-staff-on-duty',
    () => getActiveDutyStaff(),
    { refreshInterval: 15000, revalidateOnFocus: true, dedupingInterval: 5000 }
  );

  const {
    data: churnData,
  } = useSWR<{ count: number; thresholdDays: number }>('dashboard-churn-risk', async () => {
    const res = await getChurnRiskCustomers();
    return { count: res.count, thresholdDays: res.thresholdDays };
  }, { ...swrOpts, refreshInterval: 60000 });

  const {
    data: resources,
    error: resourcesError,
    isLoading: resourcesLoading,
  } = useSWR<Resource[]>(
    ['dashboard-availability', today],
    async () => {
      const results = await Promise.all(RESOURCE_TYPES.map((type) => getAvailability(today, type)));
      return results.flatMap((r) => r.resources);
    },
    swrOpts
  );

  async function handleQuickApprove(bookingId: string) {
    setActionLoading(bookingId);
    try {
      await updateBooking(bookingId, {
        status: 'CONFIRMED',
        verifiedAt: new Date().toISOString(),
      });
      await Promise.all([mutateToday(), mutatePending(), mutateRecent()]);
    } catch (err: any) {
      alert('Could not confirm this booking: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkReminderSent(bookingId: string) {
    setActionLoading(bookingId);
    try {
      await updateBooking(bookingId, {
        reminderSent: true,
      });
      toast.success('Reminder marked as sent');
      await mutateReminders();
    } catch (err: any) {
      toast.error('Could not update reminder status: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  }

  function handleSendReminderWhatsApp(booking: Booking) {
    const url = generateWhatsAppReminderUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function handleSendWhatsApp(booking: Booking) {
    const url = generateWhatsAppBookingUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function isResourceBusyNow(resource: Resource): boolean {
    if (!resource.busySlots?.length) return false;
    const now = new Date();
    return resource.busySlots.some((slot) => {
      const start = new Date(slot.startTime);
      const end = new Date(slot.endTime);
      return now >= start && now <= end;
    });
  }

  const todayList = todayBookings || [];
  const confirmedTodayBookings = todayList.filter((b) => b.status === 'CONFIRMED' || b.status === 'COMPLETED');
  const todayRevenue = confirmedTodayBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  const pendingList = pendingVerificationData || [];
  const pendingCount = pendingList.length;

  const recent5 = (allRecentBookings || []).slice(0, 5);
  const resourcesList = resources || [];
  const busyCount = activeSessions ? activeSessions.length : resourcesList.filter(isResourceBusyNow).length;

  const remindersList = remindersDueData || [];
  const remindersCount = remindersList.length;

  const initialLoading = recentLoading && !allRecentBookings && resourcesLoading && !resources;
  const error =
    todayBookingsError?.message || pendingError?.message || remindersError?.message || recentError?.message || resourcesError?.message;

  const resourcesByType = RESOURCE_TYPES.map((type) => ({
    type,
    label: RESOURCE_LABELS[type],
    resources: resourcesList.filter((r) => r.type === type),
  }));

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-72 gap-3 text-muted text-[13px]">
        <span className="spinner" />
        Loading floor data...
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">Live Operations</h1>
          <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
            Real-time floor occupancy, daily revenue and payment verification queue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playNotificationSound();
              toast.custom(
                (t) => (
                  <div
                    onClick={() => toast.dismiss(t.id)}
                    className={`${
                      t.visible ? 'animate-enter' : 'animate-leave'
                    } max-w-md w-full bg-white dark:bg-[#0f2420] shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 dark:ring-white/10 border border-emerald-500/30 p-3.5 cursor-pointer hover:border-emerald-500 transition-all`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                          Test Notification
                        </p>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Test booking: <span className="font-bold text-[#1c4b42] dark:text-[#d4a94f]">Snooker</span> - Test Customer
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        Audio chime + toast test passed
                      </p>
                    </div>
                  </div>
                ),
                { duration: 5000 }
              );
            }}
            className="btn btn-secondary min-h-[44px] text-xs py-2 px-3 border border-dashed border-line hover:border-brass flex items-center gap-1.5"
          >
            <Icon name="bell" size={13} />
            <span>Test Toast &amp; Sound</span>
          </button>
          <Link href="/new-booking" className="btn btn-primary min-h-[44px] self-start sm:self-auto py-2.5 px-4 shadow-sm">
            <Icon name="plus" size={16} />
            New walk-in booking
          </Link>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-xl px-4 py-3">
          <Icon name="alert" size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Takings / workload stat cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Highlight Card 1: Today's takings */}
        <div className="bg-brass text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-white/80">Today&apos;s Takings</span>
            <span className="p-2 rounded-xl bg-white/15 text-white">
              <Icon name="money" size={18} />
            </span>
          </div>
          <div className="my-3 sm:my-4">
            <p className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-white">
              <span className="text-xl sm:text-2xl font-bold opacity-80 mr-1">Rs </span>
              {todayRevenue.toLocaleString()}
            </p>
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-white/80">
            {confirmedTodayBookings.length} confirmed or completed
          </p>
        </div>

        {/* Highlight Card 2: Bays in Play / Bookings */}
        <div className="bg-accent-custom text-white rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-white/80">Bays In Play</span>
            <span className="p-2 rounded-xl bg-white/15 text-white">
              <Icon name="calendar" size={18} />
            </span>
          </div>
          <div className="my-3 sm:my-4">
            <p className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-white">
              {busyCount}
              <span className="text-xl sm:text-2xl font-semibold opacity-75">/{resourcesList.length}</span>
            </p>
          </div>
          <p className="text-[11px] sm:text-xs font-medium text-white/80">
            {todayList.length} booking{todayList.length === 1 ? '' : 's'} logged today
          </p>
        </div>

        {/* Staff On Duty Indicator Widget Card */}
        <Link
          href="/attendance"
          className="panel p-5 sm:p-6 flex flex-col justify-between hover:border-brass/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow group-hover:text-brass transition-colors">Staff On Duty</p>
            <span className="p-2 rounded-xl bg-brass/15 text-brass group-hover:scale-105 transition-transform">
              <Icon name="user" size={18} />
            </span>
          </div>
          <div className="my-3 sm:my-4">
            <p className="text-3xl sm:text-4xl 2xl:text-5xl font-extrabold tracking-tight text-text flex items-baseline gap-2">
              {(staffOnDuty || []).length}
              <span className="text-xs text-muted font-normal uppercase tracking-wider">active</span>
            </p>
          </div>
          <div className="flex items-center justify-between">
            {(staffOnDuty || []).length > 0 ? (
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Shift active
              </span>
            ) : (
              <span className="text-[11px] text-muted">No staff logged in</span>
            )}
            <span className="text-[11px] text-brass group-hover:underline font-semibold flex items-center gap-1">
              Logs <Icon name="arrowRight" size={11} />
            </span>
          </div>
        </Link>

        {/* Standard White Card: Awaiting Approval */}
        <div className="panel p-5 sm:p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="eyebrow">Awaiting Approval</p>
            <span className={`p-2 rounded-xl ${pendingCount > 0 ? 'bg-wait/15 text-wait' : 'bg-raised text-muted'}`}>
              <Icon name="receipt" size={18} />
            </span>
          </div>
          <div className="my-3 sm:my-4">
            <p className={`text-3xl sm:text-4xl 2xl:text-5xl font-extrabold tracking-tight ${pendingCount > 0 ? 'text-wait' : 'text-text'}`}>
              {pendingCount}
            </p>
          </div>
          {pendingCount > 0 ? (
            <Link
              href="/bookings?status=AWAITING_VERIFICATION"
              className="text-[12px] font-bold text-wait hover:underline inline-flex items-center gap-1.5"
            >
              Review payments now
              <Icon name="arrowRight" size={13} />
            </Link>
          ) : (
            <p className="text-[12px] text-muted font-medium">All payments cleared</p>
          )}
        </div>

        {/* Reminders Due Card */}
        <Link
          href="/reminders"
          className="panel p-5 sm:p-6 flex flex-col justify-between hover:border-emerald-500/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <p className="eyebrow group-hover:text-emerald-400 transition-colors">Reminders Due</p>
            <span className={`p-2 rounded-xl transition-all ${remindersCount > 0 ? 'bg-emerald-500/15 text-emerald-400 group-hover:scale-105' : 'bg-raised text-muted'}`}>
              <Icon name="bell" size={18} />
            </span>
          </div>
          <div className="my-3 sm:my-4">
            <p className={`text-3xl sm:text-4xl 2xl:text-5xl font-extrabold tracking-tight ${remindersCount > 0 ? 'text-emerald-400' : 'text-text'}`}>
              {remindersCount}
            </p>
          </div>
          {remindersCount > 0 ? (
            <span className="text-[12px] font-bold text-emerald-400 inline-flex items-center gap-1.5 group-hover:underline">
              Manage reminders
              <Icon name="arrowRight" size={13} />
            </span>
          ) : (
            <p className="text-[12px] text-muted font-medium">No alerts pending</p>
          )}
        </Link>
      </div>

      {/* Churn Risk Banner - customers inactive 30+ days */}
      {churnData && churnData.count > 0 && (
        <Link
          href="/customers?tier=CHURN_RISK"
          className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/50 transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-500/15 text-rose-400 group-hover:scale-105 transition-transform">
              <Icon name="clock" size={18} />
            </span>
            <div>
              <p className="text-[13px] font-bold text-text">
                <span className="text-rose-400">{churnData.count}</span> customer{churnData.count === 1 ? '' : 's'} haven&apos;t visited in {churnData.thresholdDays}+ days
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                These guests used to visit regularly - click to send win-back messages.
              </p>
            </div>
          </div>
          <span className="text-[12px] font-bold text-rose-400 inline-flex items-center gap-1 shrink-0 group-hover:underline">
            View At-Risk
            <Icon name="arrowRight" size={13} />
          </span>
        </Link>
      )}

      {/* Payment queue */}
      {pendingCount > 0 && (
        <section className="panel border-wait/40">
          <div className="panel-head flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="display text-[16px] sm:text-[17px] text-text flex items-center gap-2">
                Payment queue
                <span className="pill pill-wait text-[10px]">{pendingCount} waiting</span>
              </h2>
              <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">
                Oldest upload first, whatever date the booking is for.
              </p>
            </div>
            <Link
              href="/bookings?status=AWAITING_VERIFICATION"
              className="text-[12px] text-muted hover:text-brass transition-colors inline-flex items-center gap-1.5 shrink-0"
            >
              Open manager
              <Icon name="arrowRight" size={13} />
            </Link>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {pendingList.map((booking) => {
              const startTime = new Date(booking.startTime);
              const endTime = new Date(booking.endTime);
              const submittedAt = booking.paymentSubmittedAt ? new Date(booking.paymentSubmittedAt) : null;
              const isToday = booking.startTime.startsWith(today);

              return (
                <article key={booking.id} className="bg-raised border border-line rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-text truncate">{booking.customer.name}</p>
                        <p className="text-[12px] text-muted tnum mt-0.5">{booking.customer.phone}</p>
                      </div>
                      <span className={`pill shrink-0 ${isToday ? 'pill-brass' : 'pill-neutral'}`}>
                        {isToday ? 'Today' : formatDateReadable(startTime)}
                      </span>
                    </div>

                    <dl className="mt-3.5 pt-3.5 border-t border-line-soft space-y-2 text-[12px]">
                      <div className="flex justify-between gap-3">
                        <dt className="text-faint">Bay</dt>
                        <dd className="text-text font-medium truncate">{booking.resource.name}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-faint">Slot</dt>
                        <dd className="text-text tnum">
                          {formatTime12h(startTime)} - {formatTime12h(endTime)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-faint">Amount</dt>
                        <dd className="text-brass font-bold tnum">Rs {booking.totalPrice.toLocaleString()}</dd>
                      </div>
                      {submittedAt && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-faint">Uploaded</dt>
                          <dd className="text-muted tnum">
                            {submittedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    {booking.paymentScreenshotUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const fullUrl = booking.paymentScreenshotUrl?.startsWith('http')
                            ? booking.paymentScreenshotUrl
                            : `http://localhost:3001${booking.paymentScreenshotUrl}`;
                          setActiveProofUrl(fullUrl);
                        }}
                        className="btn btn-ghost w-full min-h-[44px] mt-3.5 text-[12px] py-2"
                      >
                        <Icon name="eye" size={14} />
                        View payment proof
                      </button>
                    )}

                    <div className="flex items-center gap-2 mt-3.5 pt-3.5 border-t border-line-soft">
                      <Link href={`/bookings/${booking.id}`} className="btn btn-ghost min-h-[44px] text-[12px] py-2 px-3">
                        Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleQuickApprove(booking.id)}
                        disabled={actionLoading === booking.id}
                        className="btn btn-confirm flex-1 min-h-[44px] text-[12px] py-2"
                      >
                        {actionLoading === booking.id ? <span className="spinner" /> : <Icon name="check" size={14} />}
                        {actionLoading === booking.id ? 'Confirming...' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Latest bookings */}
      <section className="panel">
        <div className="panel-head flex items-center justify-between">
          <div>
            <h2 className="display text-[16px] sm:text-[17px] text-text">Latest bookings</h2>
            <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">The five most recent reservations.</p>
          </div>
          <Link
            href="/bookings"
            className="text-[12px] text-muted hover:text-brass transition-colors inline-flex items-center gap-1.5 shrink-0"
          >
            View all
            <Icon name="arrowRight" size={13} />
          </Link>
        </div>

        {recent5.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-muted">
            No bookings yet. Start one from{' '}
            <Link href="/new-booking" className="text-brass hover:underline">
              New Booking
            </Link>
            .
          </p>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table min-w-[700px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Bay</th>
                    <th>Slot</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recent5.map((booking) => {
                    const startTime = new Date(booking.startTime);
                    const endTime = new Date(booking.endTime);
                    const isPending = booking.status === 'PENDING' || booking.status === 'AWAITING_VERIFICATION';

                    return (
                      <tr key={booking.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-text">{booking.customer.name}</span>
                            <span className="pill pill-bare pill-neutral">
                              {booking.isWalkIn ? 'Walk-in' : 'Online'}
                            </span>
                          </div>
                          <div className="text-[12px] text-faint tnum mt-0.5">{booking.customer.phone}</div>
                        </td>

                        <td>
                          <div className="text-text font-medium">{booking.resource.name}</div>
                          <div className="text-[11px] text-faint mt-0.5">
                            {RESOURCE_LABELS[booking.resource.type] ?? booking.resource.type}
                          </div>
                        </td>

                        <td className="tnum">
                          <div className="text-text font-medium">{formatDateReadable(startTime)}</div>
                          <div className="text-[12px] text-faint mt-0.5">
                            {formatTime12h(startTime)} - {formatTime12h(endTime)}
                          </div>
                        </td>

                        <td className="tnum font-bold text-text whitespace-nowrap">
                          Rs {booking.totalPrice.toLocaleString()}
                        </td>

                        <td>
                          <span className={`pill ${STATUS_PILL[booking.status] ?? 'pill-wait'}`}>
                            {booking.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        <td className="text-right">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleQuickApprove(booking.id)}
                              disabled={actionLoading === booking.id}
                              className="btn btn-confirm py-1.5 px-3 text-[12px]"
                            >
                              {actionLoading === booking.id ? (
                                <span className="spinner" />
                              ) : (
                                <Icon name="check" size={14} />
                              )}
                              {actionLoading === booking.id ? 'Confirming...' : 'Confirm'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(booking)}
                              className="btn btn-ghost py-1.5 px-3 text-[12px]"
                              title="Open WhatsApp with the confirmation message ready"
                            >
                              <Icon name="message" size={14} />
                              WhatsApp
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Stack View */}
            <div className="block md:hidden p-4 space-y-3">
              {recent5.map((booking) => {
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const isPending = booking.status === 'PENDING' || booking.status === 'AWAITING_VERIFICATION';

                return (
                  <div key={booking.id} className="p-4 rounded-xl bg-raised border border-line-soft space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-[14px] text-text">{booking.customer.name}</span>
                          <span className="pill pill-bare pill-neutral text-[9px] py-0.5 px-1.5">
                            {booking.isWalkIn ? 'Walk-in' : 'Online'}
                          </span>
                        </div>
                        <p className="text-[12px] text-faint tnum mt-0.5">{booking.customer.phone}</p>
                      </div>
                      <span className={`pill ${STATUS_PILL[booking.status] ?? 'pill-wait'} text-[10px]`}>
                        {booking.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[12px] pt-2 border-t border-line-soft">
                      <div>
                        <span className="text-faint text-[10px] block uppercase">Bay</span>
                        <span className="font-semibold text-text">{booking.resource.name}</span>
                      </div>
                      <div>
                        <span className="text-faint text-[10px] block uppercase">Amount</span>
                        <span className="font-bold text-brass tnum">Rs {booking.totalPrice.toLocaleString()}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-faint text-[10px] block uppercase">Time</span>
                        <span className="text-text tnum">
                          {formatDateReadable(startTime)}, {formatTime12h(startTime)} - {formatTime12h(endTime)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-line-soft flex items-center gap-2">
                      <Link href={`/bookings/${booking.id}`} className="btn btn-ghost flex-1 min-h-[44px] text-[12px] py-2">
                        Details
                      </Link>
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => handleQuickApprove(booking.id)}
                          disabled={actionLoading === booking.id}
                          className="btn btn-confirm flex-1 min-h-[44px] text-[12px] py-2"
                        >
                          {actionLoading === booking.id ? <span className="spinner" /> : <Icon name="check" size={14} />}
                          Confirm
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(booking)}
                          className="btn btn-ghost flex-1 min-h-[44px] text-[12px] py-2"
                        >
                          <Icon name="message" size={14} />
                          WhatsApp
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Floor board */}
      <section className="panel">
        <div className="panel-head flex items-center justify-between">
          <div>
            <h2 className="display text-[16px] sm:text-[17px] text-text">Floor board</h2>
            <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Every bay, live. Brass means in play.</p>
          </div>
          <span className="pill pill-live shrink-0">
            <span className="pulse-dot">{busyCount} in play</span>
          </span>
        </div>

        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {resourcesByType.map(({ type, label, resources: typeResources }) => (
            <div key={type}>
              <div className="flex items-baseline gap-2.5 mb-2.5">
                <h3 className="eyebrow">{label}</h3>
                <span className="h-px flex-1 bg-line-soft" />
                <span className="text-[11px] text-faint tnum">
                  {typeResources.filter(isResourceBusyNow).length}/{typeResources.length}
                </span>
              </div>

              {typeResources.length === 0 ? (
                <p className="text-[12px] text-faint">No bays configured.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
                  {typeResources.map((resource) => {
                    const busy = isResourceBusyNow(resource);
                    return (
                      <div key={resource.id} className={`bay ${busy ? 'bay-live' : ''}`}>
                        <p className="display text-[14px] sm:text-[15px] text-text truncate">{resource.name}</p>
                        <p
                          className={`text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-[0.12em] mt-1 ${
                            busy ? 'text-brass' : 'text-faint'
                          }`}
                        >
                          {busy ? 'In play' : 'Free'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Payment proof modal */}
      {activeProofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setActiveProofUrl(null)}
        >
          <div className="panel max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="panel-head flex items-center justify-between p-4 border-b border-line-soft">
              <h3 className="display text-[16px] text-text flex items-center gap-2">
                <Icon name="receipt" size={16} className="text-brass" />
                Payment proof
              </h3>
              <button
                onClick={() => setActiveProofUrl(null)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-raised transition-colors"
                aria-label="Close"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto flex items-center justify-center bg-ink/50">
              <img
                src={activeProofUrl}
                alt="Payment proof uploaded by customer"
                className="max-h-[65vh] w-auto rounded-lg border border-line object-contain shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

