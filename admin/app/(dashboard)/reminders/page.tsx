'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { getRemindersDue, getRemindersHistory, updateBooking, type Booking } from '@/lib/api';
import { formatDateReadable, formatTime12h, formatTimeRange12h } from '@/lib/timeUtils';
import { generateWhatsAppReminderUrl } from '@/lib/whatsapp';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';

export default function RemindersPage() {
  const [activeTab, setActiveTab] = useState<'due' | 'history'>('due');
  const [remindWindowMinutes, setRemindWindowMinutes] = useState<number>(60);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [now, setNow] = useState<Date>(new Date());

  // Update real-time clock every 10 seconds for live countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const swrOpts = {
    refreshInterval: 8000,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  };

  // Fetch all due reminders (within selected window, e.g. 60 min)
  const {
    data: remindersDue,
    error: dueError,
    isLoading: dueLoading,
    mutate: mutateDue,
  } = useSWR<Booking[]>(
    ['admin-reminders-due', remindWindowMinutes],
    () => getRemindersDue({ maxMinutes: remindWindowMinutes, minMinutes: 0 }),
    swrOpts
  );

  // Fetch sent history
  const {
    data: remindersHistory,
    error: historyError,
    isLoading: historyLoading,
    mutate: mutateHistory,
  } = useSWR<Booking[]>(
    'admin-reminders-history',
    () => getRemindersHistory(100),
    swrOpts
  );

  const dueList = remindersDue || [];
  const historyList = remindersHistory || [];

  // Metrics
  const dueNowCount = useMemo(() => {
    return dueList.filter((b) => {
      const diffMins = (new Date(b.startTime).getTime() - now.getTime()) / 60000;
      return diffMins >= 0 && diffMins <= 30;
    }).length;
  }, [dueList, now]);

  const dueSoonCount = useMemo(() => {
    return dueList.filter((b) => {
      const diffMins = (new Date(b.startTime).getTime() - now.getTime()) / 60000;
      return diffMins > 30 && diffMins <= 60;
    }).length;
  }, [dueList, now]);

  const sentTodayCount = useMemo(() => {
    const todayStr = now.toISOString().split('T')[0];
    return historyList.filter((b) => {
      return b.updatedAt && b.updatedAt.startsWith(todayStr);
    }).length;
  }, [historyList, now]);

  // Combined Action: Send WhatsApp and automatically mark as Sent
  async function handleSendAndMark(booking: Booking) {
    const url = generateWhatsAppReminderUrl(booking);
    // Open WhatsApp
    window.open(url, '_blank', 'noopener,noreferrer');

    // Automatically mark as sent
    setActionLoading(booking.id);
    try {
      await updateBooking(booking.id, {
        reminderSent: true,
      });
      toast.success(`Reminder sent & logged for ${booking.customer.name}`);
      await Promise.all([mutateDue(), mutateHistory()]);
    } catch (err: any) {
      toast.error('Could not auto-mark sent: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  }

  // Manual Mark Sent
  async function handleMarkSentOnly(bookingId: string) {
    setActionLoading(bookingId);
    try {
      await updateBooking(bookingId, {
        reminderSent: true,
      });
      toast.success('Marked reminder as sent');
      await Promise.all([mutateDue(), mutateHistory()]);
    } catch (err: any) {
      toast.error('Failed to mark sent: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  }

  // Undo reminder sent
  async function handleUndoReminder(bookingId: string) {
    setActionLoading(bookingId);
    try {
      await updateBooking(bookingId, {
        reminderSent: false,
      });
      toast.success('Moved back to reminders queue');
      await Promise.all([mutateDue(), mutateHistory()]);
    } catch (err: any) {
      toast.error('Failed to move back: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(null);
    }
  }

  // Search filter
  const filteredDueList = useMemo(() => {
    if (!searchQuery.trim()) return dueList;
    const q = searchQuery.toLowerCase();
    return dueList.filter(
      (b) =>
        b.customer.name.toLowerCase().includes(q) ||
        b.customer.phone.toLowerCase().includes(q) ||
        b.resource.name.toLowerCase().includes(q)
    );
  }, [dueList, searchQuery]);

  const filteredHistoryList = useMemo(() => {
    if (!searchQuery.trim()) return historyList;
    const q = searchQuery.toLowerCase();
    return historyList.filter(
      (b) =>
        b.customer.name.toLowerCase().includes(q) ||
        b.customer.phone.toLowerCase().includes(q) ||
        b.resource.name.toLowerCase().includes(q)
    );
  }, [historyList, searchQuery]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">Booking Reminders</h1>
            <span className="pill pill-live text-[11px] font-mono">
              {dueList.length} Due
            </span>
          </div>
          <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
            Send timely WhatsApp reminder alerts before sessions start to minimize no-shows.
          </p>
        </div>

        {/* Quick Settings: Remind Window */}
        <div className="flex items-center gap-2.5 bg-raised border border-line rounded-xl px-3.5 py-1.5 shrink-0">
          <Icon name="clock" size={15} className="text-muted" />
          <span className="text-[12px] font-medium text-muted">Alert Window:</span>
          <div className="w-44">
            <Select
              size="sm"
              value={remindWindowMinutes}
              onChange={(val) => setRemindWindowMinutes(Number(val))}
              options={[
                { value: 30, label: 'Next 30 Mins' },
                { value: 45, label: 'Next 45 Mins' },
                { value: 60, label: 'Next 60 Mins (Default)' },
                { value: 90, label: 'Next 90 Mins' },
                { value: 120, label: 'Next 2 Hours' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Due Now */}
        <div className="panel p-5 rounded-2xl flex flex-col justify-between border-rose-500/30 bg-rose-500/[0.04]">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-rose-400">Due Now (≤ 30 min)</span>
            <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
              <Icon name="alert" size={18} />
            </span>
          </div>
          <div className="my-3">
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-rose-400">
              {dueNowCount}
            </p>
          </div>
          <p className="text-[11px] sm:text-[12px] text-muted font-medium">
            Starting in 30 minutes or less
          </p>
        </div>

        {/* Card 2: Due Soon */}
        <div className="panel p-5 rounded-2xl flex flex-col justify-between border-amber-500/30 bg-amber-500/[0.04]">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-amber-400">Due Soon (30–60 min)</span>
            <span className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Icon name="clock" size={18} />
            </span>
          </div>
          <div className="my-3">
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-amber-400">
              {dueSoonCount}
            </p>
          </div>
          <p className="text-[11px] sm:text-[12px] text-muted font-medium">
            Starting within 30 to 60 minutes
          </p>
        </div>

        {/* Card 3: Sent Today */}
        <div className="panel p-5 rounded-2xl flex flex-col justify-between border-emerald-500/30 bg-emerald-500/[0.04]">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-emerald-400">Sent Today</span>
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <Icon name="check" size={18} />
            </span>
          </div>
          <div className="my-3">
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-emerald-400">
              {sentTodayCount}
            </p>
          </div>
          <p className="text-[11px] sm:text-[12px] text-muted font-medium">
            Reminders dispatched today
          </p>
        </div>
      </div>

      {/* Main Container: Tabs & Search */}
      <div className="panel">
        <div className="panel-head flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-line-soft">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-raised rounded-xl border border-line-soft">
            <button
              type="button"
              onClick={() => setActiveTab('due')}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${
                activeTab === 'due'
                  ? 'bg-brass text-white shadow-sm'
                  : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              <Icon name="bell" size={15} />
              <span>Pending Reminders</span>
              <span className={`px-1.5 py-0.2 text-[10.5px] rounded-full font-mono ${
                activeTab === 'due' ? 'bg-white/20 text-white' : 'bg-line text-muted'
              }`}>
                {dueList.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-brass text-white shadow-sm'
                  : 'text-muted hover:text-text hover:bg-panel'
              }`}
            >
              <Icon name="check" size={15} />
              <span>Recently Sent</span>
              <span className={`px-1.5 py-0.2 text-[10.5px] rounded-full font-mono ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-line text-muted'
              }`}>
                {historyList.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] max-w-sm">
            <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search by name, phone or bay…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-raised border border-line rounded-xl text-[12.5px] text-text placeholder:text-muted focus:outline-none focus:border-brass"
            />
          </div>
        </div>

        {/* Tab 1: Due Reminders List */}
        {activeTab === 'due' && (
          <div className="p-4 sm:p-6">
            {dueLoading && dueList.length === 0 ? (
              <div className="py-16 text-center text-muted text-[13px] flex items-center justify-center gap-2">
                <span className="spinner" />
                Scanning upcoming slots…
              </div>
            ) : filteredDueList.length === 0 ? (
              <div className="py-16 text-center text-muted">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                  <Icon name="check" size={24} />
                </div>
                <p className="text-[15px] font-bold text-text">All reminders cleared</p>
                <p className="text-[12px] text-muted mt-1 max-w-sm mx-auto">
                  There are no confirmed sessions starting within the next {remindWindowMinutes} minutes requiring reminders.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredDueList.map((booking) => {
                  const startTime = new Date(booking.startTime);
                  const endTime = new Date(booking.endTime);
                  const diffMinutes = Math.round((startTime.getTime() - now.getTime()) / 60000);
                  const isUrgent = diffMinutes <= 30;

                  return (
                    <article
                      key={booking.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
                        isUrgent
                          ? 'bg-rose-500/[0.03] border-rose-500/40'
                          : 'bg-raised border-line'
                      }`}
                    >
                      <div>
                        {/* Header: Customer & Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[14px] font-bold text-text truncate">{booking.customer.name}</p>
                            <p className="text-[12px] text-muted font-mono mt-0.5">{booking.customer.phone}</p>
                          </div>
                          <span
                            className={`pill shrink-0 text-[10.5px] font-bold ${
                              isUrgent ? 'pill-stop animate-pulse' : 'pill-live'
                            }`}
                          >
                            {diffMinutes <= 0 ? 'Starting now' : `Starts in ${diffMinutes} min`}
                          </span>
                        </div>

                        {/* Details */}
                        <dl className="mt-3.5 pt-3.5 border-t border-line-soft space-y-2 text-[12px]">
                          <div className="flex justify-between gap-3">
                            <dt className="text-faint">Bay / Activity</dt>
                            <dd className="text-text font-semibold truncate">{booking.resource.name}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-faint">Session Time</dt>
                            <dd className="text-text font-mono font-medium">
                              {formatTime12h(startTime)} – {formatTime12h(endTime)}
                            </dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-faint">Date</dt>
                            <dd className="text-text font-medium">{formatDateReadable(startTime)}</dd>
                          </div>
                          <div className="flex justify-between gap-3">
                            <dt className="text-faint">Total Amount</dt>
                            <dd className="text-brass font-bold font-mono">₨{booking.totalPrice.toLocaleString()}</dd>
                          </div>
                        </dl>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 pt-3.5 border-t border-line-soft flex items-center gap-2">
                        {/* 1-Click Send & Auto-Mark */}
                        <button
                          type="button"
                          onClick={() => handleSendAndMark(booking)}
                          disabled={actionLoading === booking.id}
                          className="btn btn-confirm flex-1 text-[12.5px] py-2 flex items-center justify-center gap-1.5 shadow-sm"
                          title="Open WhatsApp with prefilled reminder template and automatically mark as sent"
                        >
                          {actionLoading === booking.id ? (
                            <span className="spinner" />
                          ) : (
                            <Icon name="message" size={15} />
                          )}
                          <span>Send Reminder</span>
                        </button>

                        {/* Quick details link */}
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="btn btn-ghost text-[12px] py-2 px-3"
                          title="View full booking detail"
                        >
                          Details
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sent History List */}
        {activeTab === 'history' && (
          <div className="p-4 sm:p-6">
            {historyLoading && historyList.length === 0 ? (
              <div className="py-16 text-center text-muted text-[13px] flex items-center justify-center gap-2">
                <span className="spinner" />
                Loading history…
              </div>
            ) : filteredHistoryList.length === 0 ? (
              <div className="py-16 text-center text-muted">
                <div className="w-12 h-12 rounded-2xl bg-raised border border-line-soft text-muted mx-auto flex items-center justify-center mb-3">
                  <Icon name="bell" size={24} />
                </div>
                <p className="text-[15px] font-bold text-text">No sent reminders recorded</p>
                <p className="text-[12px] text-muted mt-1">
                  When you send or mark reminders as completed, they will be archived here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[700px]">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Bay / Activity</th>
                      <th>Session Slot</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistoryList.map((booking) => {
                      const startTime = new Date(booking.startTime);
                      const endTime = new Date(booking.endTime);
                      const updatedAt = booking.updatedAt ? new Date(booking.updatedAt) : null;

                      return (
                        <tr key={booking.id}>
                          <td>
                            <div className="font-semibold text-text">{booking.customer.name}</div>
                            <div className="text-[12px] text-muted font-mono mt-0.5">{booking.customer.phone}</div>
                          </td>
                          <td>
                            <div className="font-medium text-text">{booking.resource.name}</div>
                            <div className="text-[11px] text-muted font-mono">{booking.resource.type}</div>
                          </td>
                          <td>
                            <div className="text-text font-medium">{formatDateReadable(startTime)}</div>
                            <div className="text-[12px] text-muted font-mono mt-0.5">
                              {formatTime12h(startTime)} – {formatTime12h(endTime)}
                            </div>
                          </td>
                          <td className="font-bold text-brass font-mono">
                            ₨{booking.totalPrice.toLocaleString()}
                          </td>
                          <td>
                            <span className="pill pill-live text-[10px] inline-flex items-center gap-1">
                              <Icon name="check" size={12} />
                              Sent
                            </span>
                            {updatedAt && (
                              <div className="text-[10.5px] text-faint font-mono mt-0.5">
                                {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleSendAndMark(booking)}
                                className="btn btn-ghost py-1 px-2.5 text-[11.5px]"
                                title="Resend WhatsApp message"
                              >
                                <Icon name="message" size={13} />
                                Resend
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUndoReminder(booking.id)}
                                disabled={actionLoading === booking.id}
                                className="btn btn-ghost text-muted hover:text-rose-400 py-1 px-2.5 text-[11.5px]"
                                title="Move back to pending queue"
                              >
                                Undo
                              </button>
                              <Link
                                href={`/bookings/${booking.id}`}
                                className="btn btn-ghost py-1 px-2.5 text-[11.5px]"
                              >
                                View
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
