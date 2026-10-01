'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  getCustomerById,
  adminResetCustomerPassword,
  type CustomerDetail,
} from '@/lib/api';
import { formatTime12h, formatDateReadable, formatTimeRange12h } from '@/lib/timeUtils';
import { Icon } from '@/components/Icon';
import { AdminRole } from '@/lib/auth';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

const STATUS_PILL: Record<string, string> = {
  CONFIRMED: 'pill-live',
  COMPLETED: 'pill-info',
  CANCELLED: 'pill-stop',
  REJECTED: 'pill-stop',
  PENDING_PAYMENT: 'pill-wait',
  EXPIRED: 'pill-neutral',
};

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const router = useRouter();

  const [userRole, setUserRole] = useState<AdminRole>('SUPER_ADMIN');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetResult, setResetResult] = useState<{
    customerName: string;
    customerPhone: string;
    newPassword: string;
  } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => {
    const roleCookie = getCookie('gz-admin-role') as AdminRole | null;
    if (roleCookie) setUserRole(roleCookie);
  }, []);

  const {
    data: customer,
    error,
    isLoading,
    mutate,
  } = useSWR<CustomerDetail>(
    customerId ? `customer-detail-${customerId}` : null,
    () => getCustomerById(customerId),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResetPassword = async () => {
    if (!customer) return;
    if (!confirm(`Are you sure you want to generate a new temporary password for ${customer.name}?`)) return;

    setResettingPassword(true);
    try {
      const res = await adminResetCustomerPassword(customer.id);
      setResetResult({
        customerName: res.customerName,
        customerPhone: res.customerPhone,
        newPassword: res.newPassword,
      });
      setResetModalOpen(true);
      showToast('Password reset successfully!');
      mutate();
    } catch (err: any) {
      alert(err.message || 'Failed to reset password.');
    } finally {
      setResettingPassword(false);
    }
  };

  const formatCleanPhone = (phone: string) => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('0')) {
      clean = '92' + clean.slice(1);
    }
    return clean;
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-muted font-mono animate-pulse space-y-2">
        <Icon name="refresh" size={24} className="animate-spin mx-auto text-brass" />
        <p>Loading customer profile and visit history…</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="panel p-8 text-center space-y-4 max-w-lg mx-auto mt-12 rounded-3xl">
        <div className="w-12 h-12 rounded-full bg-stop/10 text-stop flex items-center justify-center mx-auto">
          <Icon name="alert" size={24} />
        </div>
        <h2 className="text-lg font-bold text-text">Customer Profile Not Found</h2>
        <p className="text-xs text-muted">
          The requested customer record does not exist or may have been deleted.
        </p>
        <Link href="/customers" className="btn btn-ghost px-5 py-2 text-xs font-semibold inline-block">
          ← Back to Customers Directory
        </Link>
      </div>
    );
  }

  const isTopVip = customer.stats.vipTier === 'VIP';
  const isLoyal = customer.stats.vipTier === 'LOYAL';
  const whatsappUrl = `https://wa.me/${formatCleanPhone(customer.phone)}`;

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-panel border border-brass text-text text-sm font-semibold shadow-2xl animate-in fade-in flex items-center gap-3">
          <Icon name="check" size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb / Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/customers"
          className="text-xs font-semibold text-muted hover:text-text flex items-center gap-1.5 transition-colors"
        >
          <span>←</span>
          <span>Back to Customers Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Direct WhatsApp */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn px-4 py-2 text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
          >
            <Icon name="message" size={13} />
            <span>WhatsApp</span>
          </a>

          {/* Phone Call */}
          <a
            href={`tel:${customer.phone}`}
            className="btn btn-ghost px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <Icon name="phone" size={13} />
            <span>Call</span>
          </a>

          {/* Reset Password (Super Admin & Manager only, for registered accounts) */}
          {customer.isRegistered && (userRole === 'SUPER_ADMIN' || userRole === 'MANAGER') && (
            <button
              onClick={handleResetPassword}
              disabled={resettingPassword}
              className="btn btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Icon name="lock" size={13} />
              <span>Reset Password</span>
            </button>
          )}
        </div>
      </div>

      {/* Customer Header Info Card */}
      <div className="panel p-6 sm:p-8 rounded-3xl border border-line-soft shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start sm:items-center gap-4">
            {customer.profilePictureUrl ? (
              <img
                src={customer.profilePictureUrl.startsWith('http') ? customer.profilePictureUrl : `http://localhost:3001${customer.profilePictureUrl}`}
                alt={customer.name}
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-line shadow-sm"
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shrink-0 ${
                  isTopVip
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-lg shadow-amber-500/25'
                    : isLoyal
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-400 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-subtle text-text border border-line-soft'
                }`}
              >
                {customer.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-text tracking-tight">
                  {customer.name}
                </h1>

                {/* Tier Badge */}
                {isTopVip ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-xs">
                    <Icon name="tag" size={12} />
                    <span>VIP ELITE</span>
                  </span>
                ) : isLoyal ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/40">
                    <Icon name="tag" size={12} />
                    <span>LOYAL GUEST</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-subtle text-muted border border-line-soft">
                    Regular Guest
                  </span>
                )}

                {/* Account Type Badge */}
                {customer.isRegistered ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <Icon name="lock" size={11} />
                    <span>Registered Account</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-raised text-muted border border-line-soft">
                    Walk-in Guest
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted pt-1">
                <span className="font-mono text-text font-bold flex items-center gap-1.5">
                  <Icon name="phone" size={12} />
                  <span>{customer.phone}</span>
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="message" size={12} />
                    <span>{customer.email}</span>
                  </span>
                )}
                <span className="text-faint">
                  Member Since: {new Date(customer.createdAt).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregated Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Confirmed Visits */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="eyebrow block">Total Completed Visits</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-text font-display">
              {customer.stats.totalVisits}
            </span>
            <span className="text-xs text-muted">sessions</span>
          </div>
          <p className="text-[11px] text-faint">Out of {customer.stats.totalBookingsCount} total bookings</p>
        </div>

        {/* Total Spent */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="eyebrow block">Lifetime Spend</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              ₨{customer.stats.totalSpent.toLocaleString()}
            </span>
            <span className="text-xs text-muted">PKR</span>
          </div>
          <p className="text-[11px] text-faint">Net revenue received</p>
        </div>

        {/* Average Spend per Visit */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="eyebrow block">Average Per Visit</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl sm:text-3xl font-black text-text font-mono">
              ₨{customer.stats.avgSpendPerVisit.toLocaleString()}
            </span>
            <span className="text-xs text-muted">/ visit</span>
          </div>
          <p className="text-[11px] text-faint">Avg booking ticket size</p>
        </div>

        {/* Last Activity */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="eyebrow block">Last Session</span>
          <div className="mt-2">
            {customer.stats.lastVisit ? (
              <>
                <span className="text-base sm:text-lg font-bold text-text block">
                  {new Date(customer.stats.lastVisit).toLocaleDateString('en-PK', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-[11px] font-mono text-muted">
                  {new Date(customer.stats.lastVisit).toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </span>
              </>
            ) : (
              <span className="text-muted text-sm">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Full Booking History Table */}
      <div className="panel rounded-3xl border border-line-soft overflow-hidden shadow-xs">
        <div className="panel-head">
          <div>
            <span className="eyebrow">Booking History</span>
            <h2 className="text-base font-bold text-text mt-0.5">
              All Past &amp; Upcoming Bookings ({customer.bookings.length})
            </h2>
          </div>
          <Link
            href={`/new-booking?phone=${customer.phone}&name=${encodeURIComponent(customer.name)}`}
            className="btn btn-primary px-3.5 py-1.5 text-xs font-bold"
          >
            + New Booking
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-raised/70 border-b border-line text-[11px] font-bold text-muted uppercase tracking-wider">
                <th className="py-3.5 px-5">Activity / Station</th>
                <th className="py-3.5 px-4">Date &amp; Time Slot</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-[13px]">
              {customer.bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    No bookings found for this customer record.
                  </td>
                </tr>
              ) : (
                customer.bookings.map((booking) => {
                  const statusClass = STATUS_PILL[booking.status] || 'pill-neutral';

                  return (
                    <tr key={booking.id} className="hover:bg-raised/40 transition-colors">
                      {/* Activity Name */}
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-text">{booking.resourceName}</div>
                        <div className="text-[11px] font-mono text-muted">{booking.resourceType}</div>
                      </td>

                      {/* Date & Time Slot */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-text">
                          {formatDateReadable(booking.startTime)}
                        </div>
                        <div className="text-[11px] font-mono text-muted">
                          {formatTimeRange12h(booking.startTime, booking.endTime)}
                        </div>
                      </td>

                      {/* Online vs Walk-In */}
                      <td className="py-3.5 px-4">
                        {booking.isWalkIn ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Walk-In
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            Online
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`pill ${statusClass}`}>{booking.status}</span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-emerald-400">
                          ₨{booking.totalPrice.toLocaleString()}
                        </div>
                        {booking.appliedOfferTitle && (
                          <div className="text-[10px] text-amber-400 truncate max-w-[120px] flex items-center gap-1">
                            <Icon name="tag" size={10} />
                            <span>{booking.appliedOfferTitle}</span>
                          </div>
                        )}
                      </td>

                      {/* View Booking Link */}
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="btn btn-ghost px-3 py-1 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetModalOpen && resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-panel border border-line rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-line-soft pb-3">
              <div>
                <h3 className="text-lg font-bold text-text">Password Reset Generated</h3>
                <p className="text-xs text-muted">Provide these temporary credentials to the customer</p>
              </div>
              <button
                onClick={() => setResetModalOpen(false)}
                className="text-muted hover:text-text font-bold text-base cursor-pointer p-1"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1.5">
                <Icon name="check" size={13} />
                <span>Password Updated in Database</span>
              </span>
              <p>The customer can log in using their phone number and this temporary password.</p>
            </div>

            <div className="space-y-3 bg-raised p-4 rounded-2xl border border-line-soft">
              <div>
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider block">
                  Customer
                </span>
                <span className="text-[14px] font-bold text-text">{resetResult.customerName}</span>
              </div>

              <div>
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider block">
                  Phone (Login ID)
                </span>
                <span className="text-[14px] font-mono text-text">{resetResult.customerPhone}</span>
              </div>

              <div>
                <span className="text-[11px] text-muted uppercase font-bold tracking-wider block">
                  New Password
                </span>
                <div className="flex items-center justify-between mt-1 p-2.5 bg-panel rounded-xl border border-brass/50">
                  <span className="text-base font-mono font-black text-brass">
                    {resetResult.newPassword}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(resetResult.newPassword);
                      setCopiedPassword(true);
                      showToast('Password copied to clipboard!');
                      setTimeout(() => setCopiedPassword(false), 2000);
                    }}
                    className="text-xs font-bold text-muted hover:text-text px-2 py-1 bg-raised rounded-lg border border-line cursor-pointer"
                  >
                    {copiedPassword ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResetModalOpen(false)}
                className="btn btn-primary px-5 py-2 text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
