'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import useSWR from 'swr';
import { getBookings, updateBooking, downloadBookingReceiptPdf, startLiveSession, type Booking, type GetBookingsParams } from '@/lib/api';
import { formatDateReadable, formatTimeRange12h } from '@/lib/timeUtils';
import { generateWhatsAppBookingUrl } from '@/lib/whatsapp';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'AWAITING_VERIFICATION', label: 'Payment to review' },
  { value: 'PENDING_PAYMENT', label: 'On 15-minute hold' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Payment rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const ACTIVITY_OPTIONS = [
  { value: 'SNOOKER', label: 'Snooker' },
  { value: 'PS5_OPEN', label: 'PS5 Open' },
  { value: 'PS5_PRIVATE', label: 'PS5 Private' },
  { value: 'CINEMA', label: 'Cinema' },
  { value: 'TABLE_TENNIS', label: 'Table Tennis' },
  { value: 'CAR_SIMULATOR', label: 'Car Simulator' },
];

const DATE_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'last3', label: '3 days' },
  { id: 'last7', label: '7 days' },
  { id: 'last15', label: '15 days' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
];

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: 'pill-live',
  COMPLETED: 'pill-info',
  CANCELLED: 'pill-stop',
  REJECTED: 'pill-stop',
  EXPIRED: 'pill-neutral',
};

const STATUS_LABEL: Record<string, string> = {
  AWAITING_VERIFICATION: 'Review payment',
  PENDING_PAYMENT: 'On hold',
};

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ').toLowerCase();
}

function BookingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStatus = searchParams.get('status') || '';
  const urlDate = searchParams.get('date');

  const [dateTab, setDateTab] = useState<string>(urlStatus ? 'all' : urlDate ? 'custom' : 'today');
  const [customFrom, setCustomFrom] = useState<string>(urlDate || '');
  const [customTo, setCustomTo] = useState<string>(urlDate || '');
  const [selectedStatus, setSelectedStatus] = useState<string>(urlStatus);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [bookingType, setBookingType] = useState<'both' | 'online' | 'walkin'>('both');
  const [whatsappFilter, setWhatsappFilter] = useState<'all' | 'sent' | 'not_sent'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isFilterOpen, setIsFilterOpen] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeSlipBooking, setActiveSlipBooking] = useState<Booking | null>(null);

  const [whatsappSentMap, setWhatsappSentMap] = useState<Record<string, boolean>>({});
  const [downloadingPdfId, setDownloadingPdfId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('zeroone_admin_whatsapp_sent');
      if (saved) setWhatsappSentMap(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load whatsapp sent map:', e);
    }
  }, []);

  useEffect(() => {
    if (urlStatus) {
      setSelectedStatus(urlStatus);
      setDateTab('all');
    }
  }, [urlStatus]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function markWhatsAppAsSent(bookingId: string) {
    setWhatsappSentMap((prev) => {
      if (prev[bookingId]) return prev;
      const next = { ...prev, [bookingId]: true };
      try {
        localStorage.setItem('zeroone_admin_whatsapp_sent', JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save whatsapp sent map:', e);
      }
      return next;
    });
  }

  function handlePrintSlip() {
    window.print();
  }

  async function handleDownloadPdf(bookingId: string) {
    setDownloadingPdfId(bookingId);
    try {
      const blob = await downloadBookingReceiptPdf(bookingId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const shortId = bookingId.slice(-8).toUpperCase();
      a.href = url;
      a.download = `ZeroOne-Receipt-${shortId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('PDF Receipt downloaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF receipt');
    } finally {
      setDownloadingPdfId(null);
    }
  }

  function handleSendWhatsApp(booking: Booking) {
    const url = generateWhatsAppBookingUrl(booking);
    window.open(url, '_blank', 'noopener,noreferrer');
    markWhatsAppAsSent(booking.id);
  }

  const dateRangeParams = useMemo(() => {
    const now = new Date();
    const toISODate = (d: Date) => d.toISOString().split('T')[0];
    const daysBack = (n: number) => {
      const start = new Date(now);
      start.setDate(start.getDate() - n);
      return { dateFrom: toISODate(start), dateTo: toISODate(now) };
    };

    if (dateTab === 'today') {
      const todayStr = toISODate(now);
      return { dateFrom: todayStr, dateTo: todayStr };
    }
    if (dateTab === 'last3') return daysBack(2);
    if (dateTab === 'last7') return daysBack(6);
    if (dateTab === 'last15') return daysBack(14);
    if (dateTab === 'last30') return daysBack(29);
    if (dateTab === 'custom') {
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    }
    return {};
  }, [dateTab, customFrom, customTo]);

  const apiQueryParams: GetBookingsParams = useMemo(
    () => ({
      ...dateRangeParams,
      status: selectedStatus || undefined,
      resourceType: selectedActivities.length > 0 ? selectedActivities.join(',') : undefined,
      bookingType: bookingType !== 'both' ? bookingType : undefined,
      search: searchQuery.trim() || undefined,
      sortBy,
      sortOrder,
    }),
    [dateRangeParams, selectedStatus, selectedActivities, bookingType, searchQuery, sortBy, sortOrder]
  );

  const {
    data: rawBookingsData,
    error: swrError,
    isLoading,
    mutate,
  } = useSWR<Booking[]>(
    ['admin-bookings-list', JSON.stringify(apiQueryParams)],
    () => getBookings(apiQueryParams),
    { refreshInterval: 5000, revalidateOnFocus: true, dedupingInterval: 2000 }
  );

  const filteredBookings = useMemo(() => {
    const list = rawBookingsData || [];
    if (whatsappFilter === 'all') return list;
    return list.filter((b) => {
      const isSent = !!whatsappSentMap[b.id];
      return whatsappFilter === 'sent' ? isSent : !isSent;
    });
  }, [rawBookingsData, whatsappFilter, whatsappSentMap]);

  const initialLoading = isLoading && !rawBookingsData;
  const error = swrError?.message || '';

  const toggleActivity = (type: string) => {
    setSelectedActivities((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const resetAllFilters = () => {
    setDateTab('all');
    setCustomFrom('');
    setCustomTo('');
    setSelectedStatus('');
    setSelectedActivities([]);
    setBookingType('both');
    setWhatsappFilter('all');
    setSearchQuery('');
    setSortBy('date');
    setSortOrder('desc');
  };

  const hasActiveFilters =
    dateTab !== 'all' ||
    Boolean(selectedStatus) ||
    selectedActivities.length > 0 ||
    bookingType !== 'both' ||
    whatsappFilter !== 'all' ||
    Boolean(searchQuery.trim()) ||
    sortBy !== 'date' ||
    sortOrder !== 'desc';

  async function runAction(bookingId: string, status: string, message: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setActionLoading(bookingId);
    try {
      await updateBooking(bookingId, { status });
      await mutate();
      showToast(message);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const handleApprove = (id: string) => runAction(id, 'CONFIRMED', 'Booking confirmed.');
  const handleComplete = (id: string) => runAction(id, 'COMPLETED', 'Session marked complete.');
  const handleCancel = (id: string) =>
    runAction(id, 'CANCELLED', 'Booking cancelled.', 'Cancel this booking?');

  const handleStartLiveSession = async (booking: Booking) => {
    setActionLoading(booking.id);
    try {
      await startLiveSession({
        resourceId: booking.resourceId,
        bookingId: booking.id,
        customerName: booking.customer.name,
        mode: booking.resource?.type === 'SNOOKER' ? 'COUNT_UP' : 'COUNTDOWN',
      });
      showToast('Live session timer started!');
      router.push('/sessions');
    } catch (err: any) {
      alert(err.message || 'Failed to start live session');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {toastMessage && (
        <div className="fixed top-[72px] right-4 sm:right-7 z-50 panel border-live/45 px-4 py-3 flex items-center gap-3 no-print">
          <Icon name="check" size={14} className="text-live" />
          <span className="text-[12px] text-text">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-faint hover:text-text transition-colors"
            aria-label="Dismiss"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Header bar with counter & filter toggles */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <p className="text-[13px] text-muted">
          {filteredBookings.length} booking{filteredBookings.length === 1 ? '' : 's'} match your filters.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`btn min-h-[44px] ${isFilterOpen ? 'btn-primary' : 'btn-ghost'}`}
          >
            <Icon name="filter" size={14} />
            {isFilterOpen ? 'Hide filters' : 'Filters'}
            {hasActiveFilters && !isFilterOpen && <span className="w-1.5 h-1.5 rounded-full bg-brass" />}
          </button>
          {hasActiveFilters && (
            <button type="button" onClick={resetAllFilters} className="btn btn-ghost min-h-[44px]">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {isFilterOpen && (
        <section className="panel p-4 sm:p-5 space-y-4 sm:space-y-5 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-faint">
                <Icon name="search" size={15} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name or phone"
                aria-label="Search bookings"
                className="field pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-3 flex items-center text-faint hover:text-text transition-colors"
                  aria-label="Clear search"
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-by" className="eyebrow shrink-0">
                Sort
              </label>
              <div className="w-32">
                <Select
                  id="sort-by"
                  size="sm"
                  value={sortBy}
                  onChange={(val) => setSortBy(val as any)}
                  options={[
                    { value: 'date', label: 'Date' },
                    { value: 'amount', label: 'Amount' },
                    { value: 'customer', label: 'Customer' },
                  ]}
                />
              </div>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="btn btn-ghost min-h-[44px] px-2.5"
                title={sortOrder === 'desc' ? 'Showing highest first' : 'Showing lowest first'}
                aria-label={sortOrder === 'desc' ? 'Sort lowest first' : 'Sort highest first'}
              >
                <Icon
                  name="chevronDown"
                  size={15}
                  className={sortOrder === 'asc' ? 'rotate-180' : ''}
                />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DATE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDateTab(tab.id)}
                aria-pressed={dateTab === tab.id}
                className={`btn min-h-[44px] py-1 px-3 text-[12px] ${dateTab === tab.id ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {dateTab === 'custom' && (
            <div className="flex flex-wrap items-end gap-3 bg-raised border border-line rounded-xl p-4">
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="from" className="field-label">
                  From
                </label>
                <input
                  id="from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="field tnum w-full"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="to" className="field-label">
                  To
                </label>
                <input
                  id="to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="field tnum w-full"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-line">
            <div>
              <Select
                id="status"
                label="Status"
                value={selectedStatus}
                onChange={(val) => setSelectedStatus(val)}
                options={STATUS_OPTIONS}
              />
            </div>

            <div>
              <p className="field-label">Booked through</p>
              <div className="flex gap-1.5">
                {[
                  { id: 'both', label: 'Both' },
                  { id: 'online', label: 'Online' },
                  { id: 'walkin', label: 'Walk-in' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setBookingType(t.id as any)}
                    aria-pressed={bookingType === t.id}
                    className={`btn min-h-[44px] flex-1 py-1.5 text-[12px] ${bookingType === t.id ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="field-label">WhatsApp Confirmation</p>
              <div className="flex gap-1.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'sent', label: 'Sent' },
                  { id: 'not_sent', label: 'Not sent' },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWhatsappFilter(w.id as any)}
                    aria-pressed={whatsappFilter === w.id}
                    className={`btn min-h-[44px] flex-1 py-1.5 text-[12px] ${whatsappFilter === w.id ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-line">
            <div className="flex items-center justify-between mb-2">
              <p className="field-label mb-0">Activities</p>
              {selectedActivities.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedActivities([])}
                  className="text-[11px] text-muted hover:text-brass transition-colors"
                >
                  Clear selection
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_OPTIONS.map((act) => (
                <button
                  key={act.value}
                  type="button"
                  onClick={() => toggleActivity(act.value)}
                  aria-pressed={selectedActivities.includes(act.value)}
                  className={`btn min-h-[44px] py-1 px-3 text-[12px] ${selectedActivities.includes(act.value) ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                >
                  {act.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5 no-print">
          <Icon name="alert" size={14} className="mt-px" />
          <span>{error}</span>
        </p>
      )}

      {/* Main List Section */}
      <section className="panel overflow-hidden no-print">
        {initialLoading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted text-[13px]">
            <span className="spinner" />
            Loading bookings...
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Icon name="calendar" size={26} className="text-faint mx-auto" />
            <h2 className="display text-[20px] text-text mt-4">Nothing matches</h2>
            <p className="text-[13px] text-muted mt-2 max-w-sm mx-auto leading-relaxed">
              No bookings fall inside this date range and filter set.
            </p>
            {hasActiveFilters && (
              <button type="button" onClick={resetAllFilters} className="btn btn-ghost mt-6 mx-auto">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card-Based Stack (for screens < 768px) */}
            <div className="block md:hidden divide-y divide-line-soft">
              {filteredBookings.map((booking) => {
                const startTime = new Date(booking.startTime);
                const endTime = new Date(booking.endTime);
                const isSent = !!whatsappSentMap[booking.id];
                const isAwaitingVerification = booking.status === 'AWAITING_VERIFICATION';
                const isPending =
                  booking.status === 'PENDING' ||
                  booking.status === 'PENDING_PAYMENT' ||
                  isAwaitingVerification;
                const busy = actionLoading === booking.id;

                return (
                  <div
                    key={booking.id}
                    onClick={() => router.push(`/bookings/${booking.id}`)}
                    className={`p-4 space-y-3 cursor-pointer transition-colors active:bg-raised ${
                      isAwaitingVerification ? 'bg-wait/8' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-text text-[14.5px]">{booking.customer.name}</span>
                          <span className="pill pill-bare pill-neutral text-[9px]">
                            {booking.isWalkIn ? 'Walk-in' : 'Online'}
                          </span>
                          {booking.bookingGroupId && (
                            <span className="pill pill-bare bg-brass/15 text-brass border border-brass/30 text-[9px] font-bold">
                              Group
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-faint tnum mt-0.5">{booking.customer.phone}</div>
                      </div>
                      <span className={`pill text-[10px] ${STATUS_PILL[booking.status] ?? 'pill-wait'}`}>
                        {statusLabel(booking.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[12.5px] bg-raised/50 border border-line-soft rounded-lg p-2.5">
                      <div>
                        <span className="eyebrow text-[9px]">Bay / Activity</span>
                        <p className="text-text font-medium mt-0.5 truncate">{booking.resource.name}</p>
                      </div>
                      <div>
                        <span className="eyebrow text-[9px]">Total Amount</span>
                        <p className="text-brass font-bold tnum mt-0.5">Rs {booking.totalPrice.toLocaleString()}</p>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-line-soft">
                        <span className="eyebrow text-[9px]">Schedule</span>
                        <p className="text-text tnum mt-0.5">
                          {formatDateReadable(startTime)} · {formatTimeRange12h(startTime, endTime)}
                        </p>
                      </div>
                    </div>

                    {/* Action buttons bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendWhatsApp(booking);
                        }}
                        className={`btn min-h-[44px] py-1.5 px-3 text-[12px] ${isSent ? 'btn-ghost min-h-[44px]' : 'btn-confirm min-h-[44px]'}`}
                      >
                        <Icon name="message" size={13} />
                        {isSent ? 'WhatsApp Sent' : 'WhatsApp'}
                      </button>

                      <div className="flex items-center gap-1.5 ml-auto">
                        {isPending && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(booking.id);
                            }}
                            disabled={busy}
                            className="btn btn-confirm min-h-[44px] py-1.5 px-3 text-[12px]"
                          >
                            {busy ? <span className="spinner" /> : <Icon name="check" size={13} />}
                            Confirm
                          </button>
                        )}

                        {booking.status === 'CONFIRMED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(booking.id);
                            }}
                            disabled={busy}
                            className="btn btn-ghost min-h-[44px] py-1.5 px-3 text-[12px]"
                          >
                            {busy ? <span className="spinner" /> : <Icon name="check" size={13} />}
                            Done
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadPdf(booking.id);
                          }}
                          disabled={downloadingPdfId === booking.id}
                          className="btn btn-ghost min-h-[44px] py-1.5 px-2.5"
                          title="Download PDF receipt"
                          aria-label="Download PDF receipt"
                        >
                          <Icon
                            name="download"
                            size={14}
                            className={downloadingPdfId === booking.id ? 'animate-bounce text-brass' : ''}
                          />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSlipBooking(booking);
                          }}
                          className="btn btn-ghost min-h-[44px] py-1.5 px-2.5"
                          title="Print slip"
                          aria-label="Print slip"
                        >
                          <Icon name="receipt" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (for screens >= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="data-table min-w-[750px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Bay</th>
                    <th>Slot</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>WhatsApp</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((booking) => {
                    const startTime = new Date(booking.startTime);
                    const endTime = new Date(booking.endTime);
                    const isSent = !!whatsappSentMap[booking.id];
                    const isAwaitingVerification = booking.status === 'AWAITING_VERIFICATION';
                    const isPending =
                      booking.status === 'PENDING' ||
                      booking.status === 'PENDING_PAYMENT' ||
                      isAwaitingVerification;
                    const busy = actionLoading === booking.id;

                    return (
                      <tr
                        key={booking.id}
                        onClick={() => router.push(`/bookings/${booking.id}`)}
                        className={`cursor-pointer ${isAwaitingVerification ? 'bg-wait/6' : ''}`}
                      >
                        <td>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-text">{booking.customer.name}</span>
                            <span className="pill pill-bare pill-neutral">
                              {booking.isWalkIn ? 'Walk-in' : 'Online'}
                            </span>
                            {booking.bookingGroupId && (
                              <span className="pill pill-bare bg-brass/15 text-brass border border-brass/30 text-[10px] font-bold">
                                Group
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] text-faint tnum mt-0.5">{booking.customer.phone}</div>
                        </td>

                        <td>
                          <div className="text-text">{booking.resource.name}</div>
                          <div className="text-[11px] text-faint mt-0.5">{booking.resource.type}</div>
                        </td>

                        <td className="tnum whitespace-nowrap">
                          <div className="text-text">{formatDateReadable(startTime)}</div>
                          <div className="text-[12px] text-faint mt-0.5">
                            {formatTimeRange12h(startTime, endTime)}
                          </div>
                        </td>

                        <td className="tnum font-semibold text-text whitespace-nowrap">
                          Rs {booking.totalPrice.toLocaleString()}
                        </td>

                        <td>
                          <span className={`pill ${STATUS_PILL[booking.status] ?? 'pill-wait'}`}>
                            {statusLabel(booking.status)}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendWhatsApp(booking);
                            }}
                            className={`btn min-h-[44px] ${isSent ? 'btn-ghost' : 'btn-confirm'}`}
                            title="Open WhatsApp with the confirmation message ready"
                          >
                            <Icon name="message" size={14} />
                            {isSent ? 'Sent' : 'Send'}
                          </button>
                        </td>

                        <td>
                          <div className="flex items-center justify-end gap-1.5">
                            {isPending && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(booking.id);
                                }}
                                disabled={busy}
                                className="btn btn-confirm min-h-[44px]"
                              >
                                {busy ? <span className="spinner" /> : <Icon name="check" size={14} />}
                                Confirm
                              </button>
                            )}

                            {booking.status === 'CONFIRMED' && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartLiveSession(booking);
                                  }}
                                  disabled={busy}
                                  className="btn btn-primary py-1 px-2.5 text-[11.5px]"
                                  title="Start live timer on the venue floor"
                                >
                                  {busy ? <span className="spinner" /> : <Icon name="play" size={13} />}
                                  Start Session
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleComplete(booking.id);
                                  }}
                                  disabled={busy}
                                  className="btn btn-ghost min-h-[44px]"
                                  title="Mark this session finished"
                                >
                                  {busy ? <span className="spinner" /> : <Icon name="check" size={14} />}
                                  Complete
                                </button>
                              </>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadPdf(booking.id);
                              }}
                              disabled={downloadingPdfId === booking.id}
                              className="btn btn-ghost min-h-[44px] px-2.5"
                              title="Download PDF receipt"
                              aria-label="Download PDF receipt"
                            >
                              <Icon
                                name="download"
                                size={14}
                                className={downloadingPdfId === booking.id ? 'animate-bounce text-brass' : ''}
                              />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSlipBooking(booking);
                              }}
                              className="btn btn-ghost min-h-[44px] px-2.5"
                              title="Open the printable slip"
                              aria-label="Open the printable slip"
                            >
                              <Icon name="receipt" size={14} />
                            </button>

                            {(isPending || booking.status === 'CONFIRMED') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancel(booking.id);
                                }}
                                disabled={busy}
                                className="btn btn-danger"
                                title="Cancel this booking"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Printable slip modal */}
      {activeSlipBooking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Booking slip"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-ink/85 backdrop-blur-sm printable-receipt-container"
        >
          <div className="bg-white w-full max-w-md rounded-[4px] overflow-hidden printable-receipt-content flex flex-col max-h-[90vh]">
            <div className="p-5 sm:p-6 text-center border-b border-dashed border-neutral-300">
              <Image
                src="/logo-dark.png"
                alt="ZEROONE Cue & Play"
                width={180}
                height={60}
                className="h-9 sm:h-10 w-auto object-contain mx-auto mb-2"
              />
              <p className="text-[11px] text-neutral-600 mt-1.5 leading-relaxed">
                Gulistan-e-Jauhar, Karachi · 0371-2160471
                <br />
                Open 24 hours
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-[13px] text-neutral-900 overflow-y-auto">
              <div className="flex justify-between items-center pb-3 border-b border-dashed border-neutral-300">
                <span className="text-[10px] uppercase tracking-[0.12em] text-neutral-500">Booking</span>
                <span className="tnum font-semibold">
                  #{activeSlipBooking.id.slice(-8).toUpperCase()}
                </span>
              </div>

              <dl className="space-y-2.5">
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Customer</dt>
                  <dd className="font-medium text-right">{activeSlipBooking.customer.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Phone</dt>
                  <dd className="tnum text-right">{activeSlipBooking.customer.phone}</dd>
                </div>
                {activeSlipBooking.customer.email && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-neutral-500">Email</dt>
                    <dd className="text-right break-all">{activeSlipBooking.customer.email}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Bay</dt>
                  <dd className="font-medium text-right">{activeSlipBooking.resource.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Date</dt>
                  <dd className="tnum text-right">
                    {formatDateReadable(new Date(activeSlipBooking.startTime))}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Time</dt>
                  <dd className="tnum font-medium text-right">
                    {formatTimeRange12h(activeSlipBooking.startTime, activeSlipBooking.endTime)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Booked</dt>
                  <dd className="text-right">
                    {activeSlipBooking.isWalkIn ? 'At the counter' : 'Online'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-neutral-500">Status</dt>
                  <dd className="text-right uppercase text-[11px] font-semibold tracking-wider">
                    {statusLabel(activeSlipBooking.status)}
                  </dd>
                </div>
              </dl>

              <div className="pt-4 border-t-2 border-neutral-900 flex justify-between items-baseline">
                <span className="display text-[17px] text-neutral-900">Total</span>
                <span className="display tnum text-[26px] sm:text-[28px] text-neutral-900">
                  Rs {activeSlipBooking.totalPrice.toLocaleString()}
                </span>
              </div>

              <p className="text-[11px] text-neutral-500 text-center leading-relaxed pt-2">
                Show this slip at the counter when you arrive.
              </p>
            </div>

            <div className="p-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-2 no-print">
              <div className="flex items-center gap-2">
                {activeSlipBooking.status === 'PENDING' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleApprove(activeSlipBooking.id);
                      setActiveSlipBooking({ ...activeSlipBooking, status: 'CONFIRMED' });
                    }}
                    className="btn btn-confirm min-h-[44px]"
                  >
                    <Icon name="check" size={14} />
                    Confirm
                  </button>
                )}
                {activeSlipBooking.status === 'CONFIRMED' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleComplete(activeSlipBooking.id);
                      setActiveSlipBooking({ ...activeSlipBooking, status: 'COMPLETED' });
                    }}
                    className="btn btn-ghost min-h-[44px]"
                  >
                    <Icon name="check" size={14} />
                    Complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(activeSlipBooking)}
                  className="btn btn-ghost min-h-[44px]"
                >
                  <Icon name="message" size={14} />
                  WhatsApp
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSlipBooking(null)}
                  className="btn btn-ghost min-h-[44px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(activeSlipBooking.id)}
                  disabled={downloadingPdfId === activeSlipBooking.id}
                  className="btn btn-secondary min-h-[44px] flex items-center gap-1.5"
                >
                  <Icon
                    name="download"
                    size={14}
                    className={downloadingPdfId === activeSlipBooking.id ? 'animate-bounce' : ''}
                  />
                  <span>PDF</span>
                </button>
                <button type="button" onClick={handlePrintSlip} className="btn btn-primary min-h-[44px]">
                  <Icon name="print" size={14} />
                  Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-60 gap-3 text-muted text-[13px]">
          <span className="spinner" />
          Loading bookings...
        </div>
      }
    >
      <BookingsContent />
    </Suspense>
  );
}


