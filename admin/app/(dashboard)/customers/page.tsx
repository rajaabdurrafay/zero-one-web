'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getCustomers,
  exportCustomersCsv,
  adminResetCustomerPassword,
  type CustomerSummary,
} from '@/lib/api';
import { generateWhatsAppWinBackUrl } from '@/lib/whatsapp';
import { Icon } from '@/components/Icon';
import { AdminRole } from '@/lib/auth';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTier = (searchParams.get('tier')?.toUpperCase() as any) || 'ALL';

  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | 'VIP' | 'LOYAL' | 'REGISTERED' | 'CHURN_RISK'>(
    initialTier === 'CHURN_RISK' || initialTier === 'AT_RISK' ? 'CHURN_RISK' : ['VIP', 'LOYAL', 'REGISTERED'].includes(initialTier) ? initialTier : 'ALL'
  );
  const [sortBy, setSortBy] = useState<'totalSpent' | 'totalVisits' | 'lastVisit' | 'name'>(
    initialTier === 'CHURN_RISK' || initialTier === 'AT_RISK' ? 'lastVisit' : 'totalSpent'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    initialTier === 'CHURN_RISK' || initialTier === 'AT_RISK' ? 'asc' : 'desc'
  );

  const [userRole, setUserRole] = useState<AdminRole>('SUPER_ADMIN');

  // Password Reset Modal State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetResult, setResetResult] = useState<{
    customerName: string;
    customerPhone: string;
    newPassword: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const roleCookie = getCookie('gz-admin-role') as AdminRole | null;
    if (roleCookie) setUserRole(roleCookie);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchCustomersList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomers({
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        tier: tierFilter !== 'ALL' ? tierFilter : undefined,
      });
      setCustomers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load customers:', error);
      showToast('Failed to load customers list.');
    } finally {
      setLoading(false);
    }
  }, [search, sortBy, sortOrder, tierFilter]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchCustomersList();
    }, 200);

    return () => clearTimeout(debounceTimer);
  }, [fetchCustomersList]);

  // Handle CSV Export of currently filtered customers
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const blob = await exportCustomersCsv({
        search: search.trim() || undefined,
        sortBy,
        sortOrder,
        tier: tierFilter !== 'ALL' ? tierFilter : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `zeroone-customers-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('CSV export downloaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to export CSV file.');
    } finally {
      setExporting(false);
    }
  };

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalCount = customers.length;
    const vipCount = customers.filter((c) => c.isVIP).length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const topCustomer = customers.length > 0 ? customers[0] : null;

    return {
      totalCount,
      vipCount,
      totalRevenue,
      topCustomer,
    };
  }, [customers]);

  const handleSort = (field: 'totalSpent' | 'totalVisits' | 'lastVisit' | 'name') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleResetPassword = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to generate a new temporary password for this customer?')) return;

    setResettingPassword(true);
    try {
      const res = await adminResetCustomerPassword(customerId);
      setResetResult({
        customerName: res.customerName,
        customerPhone: res.customerPhone,
        newPassword: res.newPassword,
      });
      setResetModalOpen(true);
      showToast('Password reset successfully!');
      fetchCustomersList();
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

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-xl bg-panel border border-brass text-text text-sm font-semibold shadow-2xl animate-in fade-in flex items-center gap-3">
          <Icon name="check" size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">
            Customer &amp; Member Directory
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Track regular guests, VIP loyalty statuses, lifetime visit frequency, and overall spending.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="btn btn-ghost px-4 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer hover:bg-raised"
            title="Download CSV for current filtered view"
          >
            <Icon name="download" size={15} className={exporting ? 'animate-bounce' : ''} />
            <span>{exporting ? 'Exporting…' : 'Export CSV'}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchCustomersList()}
            disabled={loading}
            className="btn btn-secondary px-4 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Icon name="refresh" size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      {tierFilter === 'CHURN_RISK' && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5">
          <span className="p-2 rounded-xl bg-rose-500/15 text-rose-400 shrink-0 mt-0.5">
            <Icon name="clock" size={18} />
          </span>
          <div>
            <p className="text-[13px] font-bold text-text">
              At-Risk Customers — Inactive {'>'}30 Days
            </p>
            <p className="text-[12px] text-muted mt-0.5">
              These are repeat customers (2+ visits) who haven&apos;t booked in over 30 days. Use the <span className="text-rose-400 font-semibold">&quot;Win Back&quot;</span> button to send them a personalized WhatsApp message and bring them back.
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Unique Guests */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Total Customers Shown
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-[26px] font-black text-text">{stats.totalCount}</span>
            <span className="p-2 rounded-xl bg-subtle text-brass">
              <Icon name="user" size={20} />
            </span>
          </div>
          <span className="text-[11px] text-muted">Grouped by phone number</span>
        </div>

        {/* VIP & Loyal Members */}
        <div className="panel p-5 rounded-2xl space-y-1 border-amber-500/30 bg-amber-500/5">
          <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider block">
            VIP &amp; Loyal Members
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-[26px] font-black text-amber-400">{stats.vipCount}</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Icon name="tag" size={20} />
            </span>
          </div>
          <span className="text-[11px] text-muted">5+ Visits or ₨5,000+ Spent</span>
        </div>

        {/* Lifetime Member Spend */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Total Revenue
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-[26px] font-black text-emerald-400">
              ₨{stats.totalRevenue.toLocaleString()}
            </span>
            <span className="p-2 rounded-xl bg-subtle text-emerald-400">
              <Icon name="money" size={20} />
            </span>
          </div>
          <span className="text-[11px] text-muted">Confirmed &amp; Completed Bookings</span>
        </div>

        {/* Top Guest Performer */}
        <div className="panel p-5 rounded-2xl space-y-1">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Top Spender
          </span>
          <div className="min-w-0">
            <span className="text-[18px] font-bold text-text truncate block">
              {stats.topCustomer ? stats.topCustomer.name : 'N/A'}
            </span>
            <span className="text-[12px] font-mono text-brass">
              {stats.topCustomer ? `₨${stats.topCustomer.totalSpent.toLocaleString()}` : '₨0'} (
              {stats.topCustomer ? `${stats.topCustomer.totalVisits} visits` : '0'})
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-panel border border-line rounded-2xl shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
            <Icon name="search" size={16} />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone number, or email..."
            className="field w-full pl-10 text-[13px]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text cursor-pointer"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Tier Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-raised rounded-xl border border-line-soft">
          <button
            onClick={() => setTierFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
              tierFilter === 'ALL'
                ? 'bg-panel text-text shadow-xs border border-line/60'
                : 'text-muted hover:text-text'
            }`}
          >
            All Guests
          </button>
          <button
            onClick={() => {
              setTierFilter('CHURN_RISK');
              setSortBy('lastVisit');
              setSortOrder('asc');
            }}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              tierFilter === 'CHURN_RISK'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="clock" size={12} />
            <span>At Risk (30+ Days)</span>
          </button>
          <button
            onClick={() => setTierFilter('VIP')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              tierFilter === 'VIP'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="tag" size={12} />
            <span>VIP Only</span>
          </button>
          <button
            onClick={() => setTierFilter('LOYAL')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              tierFilter === 'LOYAL'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="tag" size={12} />
            <span>Loyal &amp; VIP</span>
          </button>
          <button
            onClick={() => setTierFilter('REGISTERED')}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
              tierFilter === 'REGISTERED'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="lock" size={12} />
            <span>Registered</span>
          </button>
        </div>
      </div>

      {/* Main Customers Table */}
      <div className="panel rounded-2xl border border-line overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-raised/70 border-b border-line text-[11px] font-bold text-muted uppercase tracking-wider">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3.5 px-5 cursor-pointer hover:text-text transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Customer Details</span>
                    {sortBy === 'name' && (
                      <span className="text-brass">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-4">Tier &amp; Status</th>
                <th
                  onClick={() => handleSort('totalVisits')}
                  className="py-3.5 px-4 cursor-pointer hover:text-text transition-colors select-none text-center sm:text-left"
                >
                  <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                    <span>Total Visits</span>
                    {sortBy === 'totalVisits' && (
                      <span className="text-brass">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalSpent')}
                  className="py-3.5 px-4 cursor-pointer hover:text-text transition-colors select-none text-right sm:text-left"
                >
                  <div className="flex items-center gap-1.5 justify-end sm:justify-start">
                    <span>Total Spent</span>
                    {sortBy === 'totalSpent' && (
                      <span className="text-brass">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lastVisit')}
                  className="py-3.5 px-4 cursor-pointer hover:text-text transition-colors select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last Visit</span>
                    {sortBy === 'lastVisit' && (
                      <span className="text-brass">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="py-3.5 px-5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft text-[13px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted font-mono animate-pulse">
                    Loading customer records…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-muted">
                    <div className="space-y-2">
                      <div className="w-10 h-10 rounded-full bg-subtle text-muted flex items-center justify-center mx-auto">
                        <Icon name="user" size={20} />
                      </div>
                      <p className="font-semibold text-text">No customers found</p>
                      <p className="text-xs text-muted max-w-sm mx-auto">
                        {search
                          ? `No records matching "${search}". Try searching a different name or phone number.`
                          : 'No confirmed or completed bookings recorded yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const whatsappUrl = `https://wa.me/${formatCleanPhone(c.phone)}`;
                  const isTopVip = c.vipTier === 'VIP';
                  const isLoyal = c.vipTier === 'LOYAL';

                  return (
                    <tr
                      key={c.phone}
                      onClick={() => router.push(`/customers/${c.id}`)}
                      className="hover:bg-raised/60 transition-colors group cursor-pointer"
                    >
                      {/* Customer Details */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {c.profilePictureUrl ? (
                            <img
                              src={c.profilePictureUrl.startsWith('http') ? c.profilePictureUrl : `http://localhost:3001${c.profilePictureUrl}`}
                              alt={c.name}
                              className="w-10 h-10 rounded-xl object-cover shrink-0 border border-line-soft shadow-xs"
                            />
                          ) : (
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isTopVip
                                  ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-black shadow-md shadow-amber-500/20'
                                  : isLoyal
                                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-400 text-white shadow-md shadow-purple-500/20'
                                  : 'bg-subtle text-text border border-line-soft'
                              }`}
                            >
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-text truncate group-hover:text-brass transition-colors">
                                {c.name}
                              </span>
                              {c.isRegistered && (
                                <span
                                  title="Registered Member with Web Account"
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-bold"
                                >
                                  Account
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[12px] font-mono text-muted">{c.phone}</span>
                              {c.email && (
                                <span className="text-[11px] text-muted truncate max-w-[150px]">
                                  • {c.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tier Badge */}
                      <td className="py-4 px-4">
                        {isTopVip ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/40 shadow-xs">
                            <Icon name="tag" size={11} />
                            <span>VIP ELITE</span>
                          </span>
                        ) : isLoyal ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-500/40">
                            <Icon name="tag" size={11} />
                            <span>LOYAL GUEST</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded bg-subtle text-muted border border-line-soft">
                            Regular
                          </span>
                        )}
                      </td>

                      {/* Total Visits */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-text">
                          <span className="text-base font-mono">{c.totalVisits}</span>
                          <span className="text-[11px] text-muted font-normal">
                            {c.totalVisits === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>
                      </td>

                      {/* Total Spent */}
                      <td className="py-4 px-4">
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                          ₨{c.totalSpent.toLocaleString()}
                        </span>
                      </td>

                      {/* Last Visit */}
                      <td className="py-4 px-4">
                        {c.lastVisit ? (
                          <div>
                            <span className="text-text font-medium block">
                              {new Date(c.lastVisit).toLocaleDateString('en-PK', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-mono text-muted">
                                {new Date(c.lastVisit).toLocaleTimeString('en-PK', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                              {c.daysInactive !== undefined && c.daysInactive !== null && (
                                <span
                                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                                    c.daysInactive >= 30
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                      : 'bg-subtle text-muted border-line-soft'
                                  }`}
                                >
                                  {c.daysInactive} {c.daysInactive === 1 ? 'day' : 'days'} ago
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* WhatsApp Win-Back / Direct Chat */}
                          {tierFilter === 'CHURN_RISK' || (c.daysInactive !== undefined && c.daysInactive !== null && c.daysInactive >= 30 && c.totalVisits >= 2) ? (
                            <a
                              href={generateWhatsAppWinBackUrl(c.name, c.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all font-semibold text-[11px] inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                              title="Send WhatsApp Win-Back Message"
                            >
                              <Icon name="message" size={13} />
                              <span>Win Back</span>
                            </a>
                          ) : (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer flex items-center justify-center"
                              title="Chat on WhatsApp"
                            >
                              <Icon name="message" size={14} />
                            </a>
                          )}

                          {/* Direct Phone Call */}
                          <a
                            href={`tel:${c.phone}`}
                            className="p-2 rounded-xl bg-subtle hover:bg-raised text-text border border-line-soft transition-colors cursor-pointer"
                            title="Call Phone Number"
                          >
                            <Icon name="phone" size={14} />
                          </a>

                          {/* Reset Password (Super Admin & Manager only) */}
                          {c.isRegistered && (userRole === 'SUPER_ADMIN' || userRole === 'MANAGER') && (
                            <button
                              onClick={(e) => handleResetPassword(e, c.id)}
                              disabled={resettingPassword}
                              className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors cursor-pointer"
                              title="Reset Member Password"
                            >
                              <Icon name="lock" size={14} />
                            </button>
                          )}

                          {/* View Detail Link */}
                          <Link
                            href={`/customers/${c.id}`}
                            className="p-2 rounded-xl bg-panel border border-line hover:border-brass text-text text-xs font-semibold inline-flex items-center gap-1 transition-all"
                            title="View Customer Profile"
                          >
                            <span>→</span>
                          </Link>
                        </div>
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
                      showToast('Password copied to clipboard!');
                    }}
                    className="text-xs font-bold text-muted hover:text-text px-2 py-1 bg-raised rounded-lg border border-line cursor-pointer"
                  >
                    Copy
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

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-muted font-mono animate-pulse">
          Loading customer directory…
        </div>
      }
    >
      <CustomersContent />
    </Suspense>
  );
}

