'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  getBookingById,
  updateBooking,
  adminResetCustomerPassword,
  downloadBookingReceiptPdf,
  downloadGroupReceiptPdf,
  verifyGroupBooking,
  type Booking,
} from '@/lib/api';
import { formatTime12h, formatDateReadable, formatTimeRange12h } from '@/lib/timeUtils';
import { generateWhatsAppBookingUrl, generateWhatsAppGroupBookingUrl } from '@/lib/whatsapp';
import { Icon } from '@/components/Icon';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'Cash',
  ONLINE_EASYPAISA: 'Easypaisa',
  ONLINE_JAZZCASH: 'JazzCash',
  ONLINE_BANK: 'Bank transfer',
};

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: 'pill-live',
  COMPLETED: 'pill-info',
  CANCELLED: 'pill-stop',
  REJECTED: 'pill-stop',
  EXPIRED: 'pill-neutral',
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-raised border border-line-soft rounded-xl p-4">
      <p className="eyebrow">{label}</p>
      <div className="text-[14px] font-semibold text-text mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-faint mt-1">{hint}</p>}
    </div>
  );
}

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const bookingId = resolvedParams.id;
  const router = useRouter();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState<boolean>(false);
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [resetPasswordResult, setResetPasswordResult] = useState<{
    customerName: string;
    newPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);

  const {
    data: booking,
    error,
    isLoading,
    mutate,
  } = useSWR<Booking>(
    bookingId ? `booking-detail-${bookingId}` : null,
    () => getBookingById(bookingId),
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem('zeroone_admin_whatsapp_sent');
      if (saved && bookingId) {
        setWhatsappSent(Boolean(JSON.parse(saved)[bookingId]));
      }
    } catch (e) {
      console.error('Failed to read localStorage:', e);
    }
  }, [bookingId]);

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }

  function writeWhatsAppState(next: boolean) {
    try {
      const saved = localStorage.getItem('zeroone_admin_whatsapp_sent');
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[bookingId] = next;
      localStorage.setItem('zeroone_admin_whatsapp_sent', JSON.stringify(parsed));
      setWhatsappSent(next);
    } catch (e) {
      console.error('Failed to update whatsapp status:', e);
    }
  }

  function toggleWhatsAppSentStatus() {
    const next = !whatsappSent;
    writeWhatsAppState(next);
    showToast(next ? 'Marked as sent on WhatsApp.' : 'Marked as not sent.');
  }

  async function handleDownloadPdf() {
    if (!booking) return;
    setDownloadingPdf(true);
    try {
      const isGroup = Boolean(booking.bookingGroupId);
      const blob = isGroup
        ? await downloadGroupReceiptPdf(booking.bookingGroupId!)
        : await downloadBookingReceiptPdf(booking.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const shortId = isGroup
        ? booking.bookingGroupId!.slice(-8).toUpperCase()
        : booking.id.slice(-8).toUpperCase();
      a.href = url;
      a.download = isGroup
        ? `ZeroOne-Group-Receipt-${shortId}.pdf`
        : `ZeroOne-Receipt-${shortId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(isGroup ? 'Group PDF Receipt downloaded!' : 'PDF Receipt downloaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF receipt');
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleSendWhatsApp() {
    if (!booking) return;
    if (booking.bookingGroupId && booking.bookingGroup) {
      window.open(generateWhatsAppGroupBookingUrl(booking.bookingGroup), '_blank', 'noopener,noreferrer');
    } else {
      window.open(generateWhatsAppBookingUrl(booking), '_blank', 'noopener,noreferrer');
    }
    writeWhatsAppState(true);
  }

  async function handleApprove() {
    if (!booking) return;
    setActionLoading('approve');
    try {
      if (booking.bookingGroupId) {
        await verifyGroupBooking(booking.bookingGroupId, {
          status: 'CONFIRMED',
          amountPaid: booking.bookingGroup?.totalAmount || booking.totalPrice,
        });
        showToast('Entire group payment verified and confirmed!');
      } else {
        await updateBooking(booking.id, {
          status: 'CONFIRMED',
          verifiedAt: new Date().toISOString(),
          amountPaid: booking.amountPaid || booking.totalPrice,
        });
        showToast('Payment verified. Booking confirmed.');
      }
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    if (!booking) return;
    setActionLoading('reject');
    try {
      if (booking.bookingGroupId) {
        await verifyGroupBooking(booking.bookingGroupId, {
          status: 'REJECTED',
          rejectionReason: rejectionReasonInput.trim() || 'Payment could not be verified',
        });
        showToast('Group payment rejected. The customer can re-upload a receipt.');
      } else {
        await updateBooking(booking.id, {
          status: 'REJECTED',
          rejectionReason: rejectionReasonInput.trim() || 'Payment could not be verified',
        });
        showToast('Payment rejected. The customer can upload a new receipt.');
      }
      setShowRejectModal(false);
      setRejectionReasonInput('');
      await mutate();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete() {
    if (!booking) return;
    setActionLoading('complete');
    try {
      await updateBooking(booking.id, { status: 'COMPLETED' });
      await mutate();
      showToast('Session marked complete.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCancel() {
    if (!booking) return;
    if (!confirm('Cancel this booking?')) return;
    setActionLoading('cancel');
    try {
      await updateBooking(booking.id, { status: 'CANCELLED' });
      await mutate();
      showToast('Booking cancelled.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResetPassword() {
    if (!booking) return;
    const ok = window.confirm(
      `Reset the password for ${booking.customer.name}? This creates a temporary password you will need to pass on to them.`
    );
    if (!ok) return;

    setActionLoading('reset-password');
    try {
      const res = await adminResetCustomerPassword(booking.customerId);
      setResetPasswordResult({ customerName: res.customerName, newPassword: res.newPassword });
      setCopiedPassword(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  const durationMinutes = useMemo(() => {
    if (!booking) return 0;
    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();
    return Math.max(0, Math.round((end - start) / (1000 * 60)));
  }, [booking]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-72 gap-3 text-muted text-[13px]">
        <span className="spinner" />
        Loading booking...
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="panel px-6 py-16 text-center max-w-lg mx-auto">
        <Icon name="alert" size={26} className="text-faint mx-auto" />
        <h2 className="display text-[20px] text-text mt-4">Booking not found</h2>
        <p className="text-[13px] text-muted mt-2">
          It may have been deleted, or the link is wrong.
        </p>
        <Link href="/bookings" className="btn btn-primary mt-6 mx-auto">
          <Icon name="chevronLeft" size={14} />
          Back to bookings
        </Link>
      </div>
    );
  }

  const startTime = new Date(booking.startTime);
  const endTime = new Date(booking.endTime);
  const createdAt = new Date(booking.createdAt);
  const isOnline = !booking.isWalkIn;
  const isPending =
    booking.status === 'PENDING' ||
    booking.status === 'PENDING_PAYMENT' ||
    booking.status === 'AWAITING_VERIFICATION';
  const isAwaitingVerification = booking.status === 'AWAITING_VERIFICATION';
  const isConfirmed = booking.status === 'CONFIRMED';
  const isCompleted = booking.status === 'COMPLETED';
  const hours = Math.floor(durationMinutes / 60);
  const mins = durationMinutes % 60;
  const durationText = [hours ? `${hours} hr` : null, mins ? `${mins} min` : null]
    .filter(Boolean)
    .join(' ') || '0 min';

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

      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.push('/bookings')}
            className="btn btn-ghost min-h-[44px] px-2.5"
            aria-label="Back to bookings"
          >
            <Icon name="chevronLeft" size={15} />
          </button>
          <h2 className="display tnum text-[22px] text-text">
            #{booking.id.slice(-8).toUpperCase()}
          </h2>
          <span className={`pill ${STATUS_PILL[booking.status] ?? 'pill-wait'}`}>
            {booking.status.replace(/_/g, ' ').toLowerCase()}
          </span>
          <span className="pill pill-bare pill-neutral">{isOnline ? 'Online' : 'Walk-in'}</span>
          {booking.bookingGroupId && (
            <span className="pill pill-bare bg-brass/15 text-brass border border-brass/30 font-bold">
              Group Booking
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-secondary min-h-[44px] flex items-center gap-1.5"
            title="Download branded PDF Receipt slip"
          >
            <Icon name="download" size={14} className={downloadingPdf ? 'animate-bounce' : ''} />
            <span>{downloadingPdf ? 'Generating...' : 'Download PDF Receipt'}</span>
          </button>

          <button type="button" onClick={() => window.print()} className="btn btn-ghost min-h-[44px]">
            <Icon name="print" size={14} />
            Print slip
          </button>
        </div>
      </div>

      {/* Group Booking Banner */}
      {booking.bookingGroupId && booking.bookingGroup && (
        <div className="panel p-5 bg-gradient-to-r from-brass/15 via-raised to-raised border border-brass/35 space-y-4 no-print shadow-sm">
          {/* Top Header Row with Status & Combined Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-soft">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brass/20 border border-brass/30 flex items-center justify-center text-brass shrink-0 shadow-sm">
                <Icon name="tag" size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[14px] font-bold text-text">Group Booking</h3>
                  <span className="pill pill-bare bg-brass/20 text-brass border border-brass/40 font-bold text-[11px] px-2 py-0.5">
                    {booking.bookingGroup.bookings?.length || 1} Activities
                  </span>
                  <span className={`pill text-[11px] py-0.5 ${STATUS_PILL[booking.bookingGroup.status] ?? 'pill-wait'}`}>
                    {booking.bookingGroup.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
                <p className="text-[12px] text-muted mt-0.5">
                  Ref: <span className="font-mono font-semibold text-text">#{booking.bookingGroup.id.slice(-8).toUpperCase()}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:text-right bg-raised/80 sm:bg-transparent p-2.5 sm:p-0 rounded-lg border sm:border-0 border-line-soft justify-between sm:justify-end">
              <div>
                <span className="eyebrow block">Combined Total</span>
                <span className="display tnum text-[18px] font-bold text-brass">
                  Rs {booking.bookingGroup.totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Navigation Activity Pills / Tabs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Switch Activity View</span>
              <span className="text-[11px] text-faint">Click any activity to view its session details</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              {booking.bookingGroup.bookings?.map((sibling, idx) => {
                const isCurrent = sibling.id === booking.id;
                const siblingStart = new Date(sibling.startTime);
                const siblingEnd = new Date(sibling.endTime);
                const siblingStatus = sibling.status;
                const statusDotColor =
                  siblingStatus === 'CONFIRMED' || siblingStatus === 'COMPLETED'
                    ? 'bg-live'
                    : siblingStatus === 'CANCELLED' || siblingStatus === 'REJECTED'
                    ? 'bg-stop'
                    : 'bg-wait';

                return (
                  <Link
                    key={sibling.id}
                    href={`/bookings/${sibling.id}`}
                    className={`group relative flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all border ${
                      isCurrent
                        ? 'bg-brand text-white border-brand shadow-md shadow-brand/20 ring-2 ring-brand/30 scale-[1.02]'
                        : 'bg-raised hover:bg-raised-hover text-text border-line-soft hover:border-line'
                    }`}
                  >
                    {/* Status Dot */}
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${statusDotColor} ${
                        isCurrent ? 'ring-2 ring-white/50' : ''
                      }`}
                      title={`Status: ${siblingStatus}`}
                    />

                    {/* Clean Resource Name */}
                    <span className={`font-semibold ${isCurrent ? 'text-white' : 'text-text'}`}>
                      {idx + 1}. {sibling.resource.name}
                    </span>

                    {/* Time Window */}
                    <span
                      className={`text-[11px] font-mono ${
                        isCurrent ? 'text-white/80' : 'text-muted'
                      }`}
                    >
                      {formatTime12h(siblingStart)}
                    </span>

                    {/* Active Check Indicator */}
                    {isCurrent && (
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0 ml-0.5">
                        <Icon name="check" size={10} />
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5">
          <section className="panel">
            <div className="panel-head">
              <h3 className="display text-[16px] text-text">Session</h3>
              <span className="pill pill-bare pill-neutral">{booking.resource.type}</span>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Bay" hint={`ID ${booking.resourceId}`}>
                <span className="font-medium">{booking.resource.name}</span>
              </Field>
              <Field label="Duration" hint="From the booked time window">
                <span className="tnum font-medium">{durationText}</span>
              </Field>
              <Field label="Date" hint="Pakistan Standard Time">
                <span className="tnum">{formatDateReadable(startTime)}</span>
              </Field>
              <Field
                label="Time"
                hint={`Starts ${formatTime12h(startTime)} · ends ${formatTime12h(endTime)}`}
              >
                <span className="tnum font-medium text-brass">
                  {formatTimeRange12h(startTime, endTime)}
                </span>
              </Field>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3 className="display text-[16px] text-text">Customer</h3>
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={actionLoading === 'reset-password'}
                className="btn btn-ghost min-h-[44px]"
                title="Generate a temporary password for this customer"
              >
                {actionLoading === 'reset-password' ? <span className="spinner" /> : <Icon name="lock" size={14} />}
                Reset password
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Name">
                <span className="font-medium truncate block">{booking.customer.name}</span>
              </Field>
              <Field label="Phone">
                <span className="tnum">{booking.customer.phone}</span>
              </Field>
              <Field label="Email">
                <span className="text-[13px] break-all">
                  {booking.customer.email || <span className="text-faint">Not given</span>}
                </span>
              </Field>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3 className="display text-[16px] text-text">Payment</h3>
              <span className="pill pill-bare pill-neutral">
                {PAYMENT_LABEL[booking.paymentMethod ?? ''] ?? 'Not chosen yet'}
              </span>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field
                  label="Status"
                  hint={
                    booking.verifiedAt
                      ? `Verified ${formatDateReadable(new Date(booking.verifiedAt))}`
                      : 'Not verified yet'
                  }
                >
                  {booking.isWalkIn
                    ? 'Paid at the counter'
                    : isConfirmed || isCompleted
                    ? 'Verified'
                    : isAwaitingVerification
                    ? 'Waiting on you'
                    : 'Not paid yet'}
                </Field>

                <Field
                  label="Amount"
                  hint={
                    booking.amountPaid != null && booking.amountPaid < booking.totalPrice
                      ? `Short by Rs ${(booking.totalPrice - booking.amountPaid).toLocaleString()}`
                      : 'Paid in full'
                  }
                >
                  <span className="tnum font-medium">Rs {booking.totalPrice.toLocaleString()}</span>
                  {booking.amountPaid != null && (
                    <span
                      className={`tnum text-[12px] ml-2 ${
                        booking.amountPaid >= booking.totalPrice ? 'text-live' : 'text-wait'
                      }`}
                    >
                      Rs {booking.amountPaid.toLocaleString()} in
                    </span>
                  )}
                </Field>

                <Field
                  label="Receipt"
                  hint={
                    booking.paymentSubmittedAt
                      ? `Uploaded ${formatTime12h(new Date(booking.paymentSubmittedAt))}`
                      : 'Nothing uploaded'
                  }
                >
                  {booking.paymentScreenshotUrl ? (
                    <button
                      type="button"
                      onClick={() => setShowImageModal(true)}
                      className="text-brass hover:underline text-[13px] inline-flex items-center gap-1.5 min-h-[44px]"
                    >
                      <Icon name="eye" size={14} />
                      View
                    </button>
                  ) : (
                    <span className="text-faint text-[13px]">None</span>
                  )}
                </Field>
              </div>

              {booking.rejectionReason && (
                <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5">
                  <Icon name="alert" size={14} className="mt-px" />
                  <span>
                    <span className="font-semibold">Rejected: </span>
                    {booking.rejectionReason}
                  </span>
                </p>
              )}
            </div>
          </section>

          {/* Purchased Add-ons Breakdown */}
          {booking.addons && booking.addons.length > 0 && (
            <section className="panel">
              <div className="panel-head">
                <h3 className="display text-[16px] text-text flex items-center gap-2">
                  <Icon name="coffee" size={16} className="text-brass" />
                  Cafe & Snack Add-ons ({booking.addons.length})
                </h3>
                <span className="pill pill-bare pill-neutral">
                  Rs {booking.addons.reduce((sum, ba) => sum + ba.priceAtBooking * ba.quantity, 0).toLocaleString()} Total
                </span>
              </div>
              <div className="p-5">
                <div className="space-y-2.5">
                  {booking.addons.map((ba) => (
                    <div
                      key={ba.id}
                      className="flex items-center justify-between p-3.5 rounded-xl bg-raised border border-line-soft"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-panel border border-line flex items-center justify-center text-brass">
                          <Icon name="coffee" size={14} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text">
                            {ba.addonItem?.name || 'Add-on Item'}
                          </p>
                          <p className="text-xs text-faint">
                            Rs {ba.priceAtBooking.toLocaleString()} each · Category: {ba.addonItem?.category || 'Snacks'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-muted block">Qty: {ba.quantity}</span>
                        <span className="text-sm font-bold text-brass tnum">
                          Rs {(ba.priceAtBooking * ba.quantity).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h3 className="display text-[16px] text-text">Record</h3>
            </div>
            <dl className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-[12px]">
              <div className="flex justify-between gap-3 py-1 border-b border-line-soft">
                <dt className="text-faint">Created</dt>
                <dd className="text-text tnum">
                  {formatDateReadable(createdAt)}, {formatTime12h(createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-1 border-b border-line-soft">
                <dt className="text-faint">Booked through</dt>
                <dd className="text-text">{isOnline ? 'Website' : 'Counter'}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1 border-b border-line-soft">
                <dt className="text-faint">Customer ID</dt>
                <dd className="text-text tnum truncate">{booking.customerId}</dd>
              </div>
              <div className="flex justify-between gap-3 py-1 border-b border-line-soft">
                <dt className="text-faint">WhatsApp</dt>
                <dd className={whatsappSent ? 'text-live' : 'text-wait'}>
                  {whatsappSent ? 'Sent' : 'Not sent'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Action column */}
        <div className="lg:col-span-4 space-y-5 lg:sticky lg:top-[76px] no-print">
          <section className="panel p-5">
            <p className="eyebrow">Total due</p>
            <p className="display tnum text-[42px] text-text mt-2">
              <span className="text-brass">Rs </span>
              {booking.totalPrice.toLocaleString()}
            </p>
            <p className="text-[12px] text-muted mt-2">
              {booking.isWalkIn ? 'Collected at the counter' : 'Paid online, verified here'}
            </p>
          </section>

          {booking.paymentScreenshotUrl && (
            <section className="panel">
              <div className="panel-head">
                <h3 className="display text-[15px] text-text">Payment proof</h3>
                <span className="pill pill-live">Uploaded</span>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="block w-full bg-ink cursor-zoom-in"
              >
                <img
                  src={`${API_BASE}${booking.paymentScreenshotUrl}`}
                  alt="Payment receipt uploaded by the customer"
                  className="w-full max-h-60 object-contain mx-auto"
                />
              </button>
              {booking.paymentSubmittedAt && (
                <p className="text-[11px] text-faint text-center py-2.5 border-t border-line tnum">
                  {formatDateReadable(new Date(booking.paymentSubmittedAt))},{' '}
                  {formatTime12h(new Date(booking.paymentSubmittedAt))}
                </p>
              )}
            </section>
          )}

          <section className="panel">
            <div className="panel-head">
              <h3 className="display text-[15px] text-text">Actions</h3>
            </div>
            <div className="p-5 space-y-2.5">
              {isAwaitingVerification && (
                <div className="bg-wait/8 border border-wait/40 rounded-[4px] p-3.5 space-y-2.5">
                  <p className="flex items-center gap-2 text-[12px] text-wait">
                    <Icon name="alert" size={14} />
                    Check the receipt before confirming.
                  </p>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading === 'approve'}
                    className="btn btn-confirm w-full min-h-[44px] py-2.5"
                  >
                    {actionLoading === 'approve' ? <span className="spinner" /> : <Icon name="check" size={14} />}
                    {actionLoading === 'approve' ? 'Confirming...' : 'Verify and confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    disabled={actionLoading === 'reject'}
                    className="btn btn-danger w-full min-h-[44px] py-2.5"
                  >
                    <Icon name="close" size={14} />
                    Reject payment
                  </button>
                </div>
              )}

              {(booking.status === 'PENDING' || booking.status === 'PENDING_PAYMENT') && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={actionLoading === 'approve'}
                  className="btn btn-confirm w-full min-h-[44px] py-2.5"
                >
                  {actionLoading === 'approve' ? <span className="spinner" /> : <Icon name="check" size={14} />}
                  {actionLoading === 'approve' ? 'Confirming...' : 'Confirm booking'}
                </button>
              )}

              {isConfirmed && (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={actionLoading === 'complete'}
                  className="btn btn-ghost w-full min-h-[44px] py-2.5"
                >
                  {actionLoading === 'complete' ? <span className="spinner" /> : <Icon name="check" size={14} />}
                  {actionLoading === 'complete' ? 'Completing...' : 'Mark complete'}
                </button>
              )}

              <button type="button" onClick={handleSendWhatsApp} className="btn btn-primary w-full min-h-[44px] py-2.5">
                <Icon name="message" size={14} />
                Send on WhatsApp
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
                className="btn btn-secondary w-full min-h-[44px] py-2.5 flex items-center justify-center gap-1.5"
              >
                <Icon name="download" size={14} className={downloadingPdf ? 'animate-bounce' : ''} />
                <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Receipt'}</span>
              </button>

              <button type="button" onClick={toggleWhatsAppSentStatus} className="btn btn-ghost w-full min-h-[44px] py-2.5">
                {whatsappSent ? 'Mark as not sent' : 'Mark as sent'}
              </button>

              {(isPending || isConfirmed) && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={actionLoading === 'cancel'}
                  className="btn btn-danger w-full min-h-[44px] py-2.5"
                >
                  {actionLoading === 'cancel' ? <span className="spinner" /> : <Icon name="close" size={14} />}
                  {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel booking'}
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {showImageModal && booking.paymentScreenshotUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Payment proof"
          onClick={() => setShowImageModal(false)}
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="panel max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="panel-head">
              <div>
                <h3 className="display text-[16px] text-text">Payment proof</h3>
                <p className="text-[12px] text-muted tnum mt-1">
                  #{booking.id.slice(-8).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-muted hover:text-text transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-ink">
              <img
                src={`${API_BASE}${booking.paymentScreenshotUrl}`}
                alt="Payment receipt uploaded by the customer"
                className="max-h-[70vh] w-auto object-contain rounded-[3px]"
              />
            </div>
            <div className="px-5 py-3 border-t border-line flex items-center justify-between gap-3 text-[12px]">
              <span className="text-muted tnum">
                Claimed Rs {(booking.amountPaid || booking.totalPrice).toLocaleString()}
              </span>
              <a
                href={`${API_BASE}${booking.paymentScreenshotUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brass hover:underline"
              >
                Open full size
              </a>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reject payment"
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="panel max-w-md w-full">
            <div className="panel-head">
              <h3 className="display text-[17px] text-text">Reject payment</h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-muted hover:text-text transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-muted leading-relaxed">
                The customer sees this reason and can upload a new receipt.
              </p>
              <div>
                <label htmlFor="reject-reason" className="field-label">
                  Reason
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Funds never arrived in the account"
                  className="field resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowRejectModal(false)} className="btn btn-ghost min-h-[44px]">
                  Go back
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading === 'reject'}
                  className="btn btn-danger min-h-[44px]"
                >
                  {actionLoading === 'reject' && <span className="spinner" />}
                  {actionLoading === 'reject' ? 'Rejecting...' : 'Reject payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetPasswordResult && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Temporary password"
          className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="panel max-w-md w-full">
            <div className="panel-head">
              <h3 className="display text-[17px] text-text">Temporary password</h3>
              <button
                onClick={() => setResetPasswordResult(null)}
                className="text-muted hover:text-text transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close"
              >
                <Icon name="close" size={17} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-[12px] text-muted leading-relaxed">
                Created for <span className="text-text">{resetPasswordResult.customerName}</span>. Their old
                password no longer works.
              </p>

              <div className="bg-ink border border-brass/40 rounded-[4px] px-4 py-5 text-center">
                <p className="eyebrow">Password</p>
                <p className="display tnum text-[30px] text-brass mt-2 tracking-[0.1em] break-all">
                  {resetPasswordResult.newPassword}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(resetPasswordResult.newPassword);
                    setCopiedPassword(true);
                    setTimeout(() => setCopiedPassword(false), 3000);
                  }}
                  className="btn btn-ghost min-h-[44px] mt-4 mx-auto"
                >
                  {copiedPassword ? <Icon name="check" size={14} /> : null}
                  {copiedPassword ? 'Copied' : 'Copy password'}
                </button>
              </div>

              <p className="text-[12px] text-muted leading-relaxed">
                Send it over WhatsApp and ask them to change it once they are in.
              </p>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setResetPasswordResult(null)}
                  className="btn btn-ghost min-h-[44px]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

