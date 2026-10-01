'use client';

import { useState } from 'react';
import useSWR from 'swr';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  getAnalyticsSummary,
  getRevenueTrend,
  getActivityBreakdown,
  getPeakHours,
  getTopCustomers,
  getRevenueByCategory,
  getTopAddons,
  downloadAnalyticsPdf,
  downloadAnalyticsExcel,
  type AnalyticsSummary,
  type RevenueTrendPoint,
  type ActivityBreakdownResponse,
  type PeakHourPoint,
  type TopCustomer,
  type RevenueByCategoryResponse,
  type AddonAnalyticsSummary,
} from '@/lib/api';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';

/* Vibrant, high-contrast, punchy palette for charts & data visualizations */
const SERIES = [
  '#6366f1', // Vibrant Indigo
  '#3b82f6', // Vivid Blue
  '#10b981', // Emerald / Mint Green
  '#f59e0b', // Radiant Amber
  '#ec4899', // Bright Pink
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

const INK = 'var(--theme-bg, #faf7f1)';
const LINE = 'var(--theme-border-soft, #e5e0d3)';
const MUTED = 'var(--theme-text-muted, #334155)';
const TEXT = 'var(--theme-text, #0d1f1b)';

const axis = {
  tick: { fontSize: 11, fill: 'var(--theme-text-muted, #334155)', fontWeight: 500 },
  axisLine: { stroke: 'var(--theme-border-soft, #e5e0d3)' },
  tickLine: false,
} as const;

const tooltipStyle = {
  backgroundColor: 'var(--theme-surface, #ffffff)',
  border: '1px solid var(--theme-border, #e5e0d3)',
  borderRadius: '8px',
  boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.08)',
  color: 'var(--theme-text, #0d1f1b)',
  fontSize: '12px',
  fontWeight: '500',
} as const;

function Toggle<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 shrink-0">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`btn py-1.5 px-3 text-[12px] ${value === opt ? 'btn-primary' : 'btn-ghost'}`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  changePct,
  changeLabel,
  note,
}: {
  label: string;
  value: string;
  changePct?: number;
  changeLabel: string;
  note: string;
}) {
  const hasChange = changePct !== undefined && changePct !== null;
  const up = (changePct ?? 0) >= 0;

  return (
    <div className="panel p-4 sm:p-5">
      <p className="eyebrow">{label}</p>
      <p className="display tnum text-[28px] sm:text-[34px] text-text mt-2 sm:mt-2.5 font-bold">{value}</p>
      <div className="flex items-center justify-between gap-2 mt-2 sm:mt-2.5">
        {hasChange ? (
          <span className={`tnum text-[11px] sm:text-[12px] font-semibold ${up ? 'text-live' : 'text-stop'}`}>
            {up ? '+' : '−'}
            {Math.abs(changePct!)}% {changeLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10.5px] sm:text-[11px] text-faint">{note}</span>
      </div>
    </div>
  );
}

function RankBadge({ index }: { index: number }) {
  return (
    <span
      className={`tnum w-5 h-5 sm:w-6 sm:h-6 rounded-md flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 ${
        index === 0 ? 'bg-brass/15 text-brass border border-brass/40' : 'bg-raised text-muted border border-line'
      }`}
    >
      {index + 1}
    </span>
  );
}

function ChartState({ loading, empty, children }: { loading: boolean; empty: boolean; children: React.ReactNode }) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-3 text-muted text-[13px]">
        <span className="spinner" />
        Loading…
      </div>
    );
  }
  if (empty) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-faint">
        Nothing recorded for this period.
      </div>
    );
  }
  return <>{children}</>;
}

export default function AnalyticsPage() {
  const [revenuePeriod, setRevenuePeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [categoryPeriod, setCategoryPeriod] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const swrOpts = { refreshInterval: 10000, dedupingInterval: 3000 };

  const { data: summary } = useSWR<AnalyticsSummary>(['analytics-summary'], getAnalyticsSummary, swrOpts);
  const { data: trend, isLoading: trendLoading } = useSWR<RevenueTrendPoint[]>(
    ['analytics-revenue-trend', revenuePeriod],
    () => getRevenueTrend(revenuePeriod),
    swrOpts
  );
  const { data: activityData, isLoading: activityLoading } = useSWR<ActivityBreakdownResponse>(
    ['analytics-activity-breakdown'],
    getActivityBreakdown,
    swrOpts
  );
  const { data: peakHours, isLoading: peakHoursLoading } = useSWR<PeakHourPoint[]>(
    ['analytics-peak-hours'],
    getPeakHours,
    swrOpts
  );
  const { data: topCustomers, isLoading: customersLoading } = useSWR<TopCustomer[]>(
    ['analytics-top-customers'],
    getTopCustomers,
    swrOpts
  );
  const { data: addonStats, isLoading: addonStatsLoading } = useSWR<AddonAnalyticsSummary>(
    ['analytics-top-addons'],
    getTopAddons,
    swrOpts
  );
  const { data: categoryData, isLoading: categoryLoading } = useSWR<RevenueByCategoryResponse>(
    ['analytics-revenue-by-category', categoryPeriod],
    () => getRevenueByCategory(categoryPeriod),
    swrOpts
  );

  const breakdownList = activityData?.breakdown || [];
  const trendList = trend || [];
  const categories = categoryData?.categories || [];

  const totalOnlineRevenue = trendList.reduce((acc, curr) => acc + curr.onlineRevenue, 0);
  const totalWalkInRevenue = trendList.reduce((acc, curr) => acc + curr.walkInRevenue, 0);
  const totalPeriodRevenue = totalOnlineRevenue + totalWalkInRevenue;

  const channelComparison = [
    {
      name: 'Walk-in',
      revenue: totalWalkInRevenue,
      percentage: totalPeriodRevenue > 0 ? Math.round((totalWalkInRevenue / totalPeriodRevenue) * 100) : 0,
      color: '#10b981',
    },
    {
      name: 'Online',
      revenue: totalOnlineRevenue,
      percentage: totalPeriodRevenue > 0 ? Math.round((totalOnlineRevenue / totalPeriodRevenue) * 100) : 0,
      color: '#6366f1',
    },
  ];

  const periodNote =
    categoryPeriod === 'today'
      ? 'today'
      : categoryPeriod === 'week'
      ? 'over 7 days'
      : categoryPeriod === 'month'
      ? 'this month'
      : 'all time';

  async function handleExportPdf() {
    setExportMenuOpen(false);
    setExportingPdf(true);
    const toastId = toast.loading(`Generating ${revenuePeriod === 'monthly' ? '30-Day' : revenuePeriod === 'weekly' ? '14-Day' : '7-Day'} PDF Report…`);
    try {
      const blob = await downloadAnalyticsPdf(revenuePeriod);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toISOString().split('T')[0];
      const pSlug = revenuePeriod === 'monthly' ? '30days' : revenuePeriod === 'weekly' ? '14days' : '7days';
      a.download = `ZeroOne-Analytics-${pSlug}-${todayStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF report downloaded successfully', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to export PDF: ' + (err.message || 'Error'), { id: toastId });
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    setExportMenuOpen(false);
    setExportingExcel(true);
    const toastId = toast.loading(`Generating ${revenuePeriod === 'monthly' ? '30-Day' : revenuePeriod === 'weekly' ? '14-Day' : '7-Day'} Excel Report…`);
    try {
      const blob = await downloadAnalyticsExcel(revenuePeriod);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const todayStr = new Date().toISOString().split('T')[0];
      const pSlug = revenuePeriod === 'monthly' ? '30days' : revenuePeriod === 'weekly' ? '14days' : '7days';
      a.download = `ZeroOne-Analytics-${pSlug}-${todayStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Excel report downloaded successfully', { id: toastId });
    } catch (err: any) {
      toast.error('Failed to export Excel: ' + (err.message || 'Error'), { id: toastId });
    } finally {
      setExportingExcel(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-line/60">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">Financial & Demand Analytics</h1>
          <p className="text-[12px] sm:text-[13px] text-muted mt-0.5">
            Real-time takings, customer trends and peak hour distribution. Refreshes every 10 seconds.
          </p>
        </div>

        {/* Export Report Dropdown */}
        <div className="relative self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            disabled={exportingPdf || exportingExcel}
            className="btn btn-primary py-2 px-4 text-[13px] flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {exportingPdf || exportingExcel ? (
              <span className="spinner" />
            ) : (
              <Icon name="download" size={15} />
            )}
            <span>Export Report</span>
            <Icon name="chevronDown" size={13} className={`transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {exportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setExportMenuOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-panel border border-line rounded-2xl shadow-xl z-40 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 border-b border-line-soft">
                  <p className="text-[10.5px] font-mono uppercase tracking-wider text-muted font-bold">
                    Range: {revenuePeriod === 'monthly' ? '30 Days' : revenuePeriod === 'weekly' ? '14 Days' : '7 Days'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold text-text hover:bg-raised rounded-xl transition-colors text-left"
                >
                  <Icon name="file" size={16} className="text-rose-400" />
                  <span>Export as PDF (.pdf)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold text-text hover:bg-raised rounded-xl transition-colors text-left"
                >
                  <Icon name="receipt" size={16} className="text-emerald-400" />
                  <span>Export as Excel (.xlsx)</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Stat
          label="Today"
          value={`₨${(summary?.today.revenue || 0).toLocaleString()}`}
          changePct={summary?.today.revenueChangePct}
          changeLabel="vs yesterday"
          note={`${summary?.today.confirmedBookings || 0} confirmed`}
        />
        <Stat
          label="Today's bookings"
          value={String(summary?.today.bookings || 0)}
          changePct={summary?.today.bookingsChangePct}
          changeLabel="vs yesterday"
          note="all statuses"
        />
        <Stat
          label="This week"
          value={`₨${(summary?.week.revenue || 0).toLocaleString()}`}
          changePct={summary?.week.revenueChangePct}
          changeLabel="vs last week"
          note={`${summary?.week.bookings || 0} bookings`}
        />
        <Stat
          label="This month"
          value={`₨${(summary?.month.revenue || 0).toLocaleString()}`}
          changePct={summary?.month.revenueChangePct}
          changeLabel="vs last month"
          note={`${summary?.month.bookings || 0} bookings`}
        />
      </div>

      {/* Revenue Trend Chart */}
      <section className="panel">
        <div className="panel-head flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="display text-[16px] sm:text-[17px] text-text">Revenue Growth</h2>
            <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Total revenue split by walk-in counter and online bookings.</p>
          </div>
          <Toggle
            options={['daily', 'weekly', 'monthly'] as const}
            value={revenuePeriod}
            onChange={setRevenuePeriod}
            labels={{ daily: '7 days', weekly: '14 days', monthly: '30 days' }}
          />
        </div>

        <div className="p-4 sm:p-6">
          <div className="h-72 sm:h-80 w-full max-h-[400px]">
            <ChartState loading={trendLoading} empty={trendList.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendList} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fillWalkIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="fillOnline" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINE} opacity={0.7} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis {...axis} width={65} tickFormatter={(val) => `₨${val.toLocaleString()}`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ stroke: '#6366f1', strokeWidth: 1.5, strokeDasharray: '4 4' }}
                    formatter={(value: any, name: any) => [
                      `₨${Number(value).toLocaleString()}`,
                      name === 'revenue' ? 'Total' : name === 'walkInRevenue' ? 'Walk-in' : 'Online',
                    ]}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconType="circle"
                    formatter={(value) => (
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--theme-text, #0d1f1b)' }}>
                        {value === 'revenue' ? 'Total' : value === 'walkInRevenue' ? 'Walk-in' : 'Online'}
                      </span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#fillRevenue)"
                    name="revenue"
                    dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="walkInRevenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#fillWalkIn)"
                    name="walkInRevenue"
                    dot={{ r: 2.5, fill: '#10b981', strokeWidth: 0 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="onlineRevenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#fillOnline)"
                    name="onlineRevenue"
                    dot={{ r: 2.5, fill: '#3b82f6', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartState>
          </div>
        </div>
      </section>

      {/* By Activity Section */}
      <section className="panel">
        <div className="panel-head flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="display text-[16px] sm:text-[17px] text-text">Where the money comes from</h2>
            <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Every activity ranked by revenue generated.</p>
          </div>
          <Toggle
            options={['today', 'week', 'month', 'all'] as const}
            value={categoryPeriod}
            onChange={setCategoryPeriod}
            labels={{ today: 'Today', week: 'Week', month: 'Month', all: 'All time' }}
          />
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-raised border border-brass/40 rounded-xl p-4">
              <p className="eyebrow">Best earner</p>
              <p className="display text-[18px] text-text mt-1.5 truncate">
                {categoryData?.topPerformer?.activityName || '—'}
              </p>
              <p className="display tnum text-[24px] sm:text-[26px] text-brass mt-1 font-bold">
                ₨{(categoryData?.topPerformer?.totalRevenue || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted mt-1.5">
                {categoryData?.topPerformer?.percentOfTotal || 0}% of takings ·{' '}
                {categoryData?.topPerformer?.totalBookings || 0} sessions
              </p>
            </div>

            <div className="bg-raised border border-line-soft rounded-xl p-4">
              <p className="eyebrow">Total {periodNote}</p>
              <p className="display tnum text-[24px] sm:text-[26px] text-text mt-1.5 font-bold">
                ₨{(categoryData?.grandTotalRevenue || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted mt-1.5">
                {categoryData?.grandTotalBookings || 0} confirmed or completed sessions
              </p>
            </div>

            <div className="bg-raised border border-line-soft rounded-xl p-4 sm:col-span-2 md:col-span-1">
              <p className="eyebrow">Quietest</p>
              <p className="display text-[18px] text-text mt-1.5 truncate">
                {categoryData?.lowestPerformer?.activityName || '—'}
              </p>
              <p className="display tnum text-[24px] sm:text-[26px] text-muted mt-1 font-bold">
                ₨{(categoryData?.lowestPerformer?.totalRevenue || 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-muted mt-1.5">
                {categoryData?.lowestPerformer?.percentOfTotal || 0}% of takings
              </p>
            </div>
          </div>

          <div className="h-60 sm:h-64 w-full">
            <ChartState loading={categoryLoading} empty={categories.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={categories} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="2 4" horizontal={false} stroke={LINE} />
                  <XAxis type="number" {...axis} tickFormatter={(val) => `₨${val.toLocaleString()}`} />
                  <YAxis
                    dataKey="activityName"
                    type="category"
                    tick={{ fontSize: 11, fill: TEXT }}
                    axisLine={{ stroke: LINE }}
                    tickLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    formatter={(value: any, _name: any, item: any) => [
                      `₨${Number(value).toLocaleString()} · ${item.payload.percentOfTotal}%`,
                      'Revenue',
                    ]}
                  />
                  <Bar dataKey="totalRevenue" radius={[0, 6, 6, 0]}>
                    {categories.map((_entry, index) => (
                      <Cell key={index} fill={SERIES[index % SERIES.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartState>
          </div>

          <div className="overflow-x-auto border border-line rounded-xl">
            <table className="data-table min-w-[650px]">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th className="text-center">Sessions</th>
                  <th className="text-right">Online</th>
                  <th className="text-right">Walk-in</th>
                  <th className="text-right">Average</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {categoryLoading ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-muted">
                      Loading…
                    </td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-faint">
                      Nothing recorded for this period.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat, idx) => (
                    <tr key={cat.resourceType}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <RankBadge index={idx} />
                          <span className="text-text font-semibold">{cat.activityName}</span>
                        </div>
                      </td>
                      <td className="text-center tnum text-text">{cat.totalBookings}</td>
                      <td className="text-right tnum text-muted">₨{cat.onlineRevenue.toLocaleString()}</td>
                      <td className="text-right tnum text-muted">₨{cat.walkInRevenue.toLocaleString()}</td>
                      <td className="text-right tnum text-muted">
                        ₨{cat.avgRevenuePerBooking.toLocaleString()}
                      </td>
                      <td className="text-right tnum font-bold text-text">
                        ₨{cat.totalRevenue.toLocaleString()}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2.5">
                          <span className="w-16 h-1.5 bg-line rounded-full overflow-hidden hidden sm:block">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${cat.percentOfTotal}%`,
                                backgroundColor: SERIES[idx % SERIES.length],
                              }}
                            />
                          </span>
                          <span className="tnum text-text w-9 text-right font-bold">{cat.percentOfTotal}%</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Popularity + Peak Hours */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <section className="panel lg:col-span-5 flex flex-col">
          <div className="panel-head flex items-center justify-between">
            <div>
              <h2 className="display text-[16px] sm:text-[17px] text-text">What gets booked</h2>
              <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Share of all sessions.</p>
            </div>
            <span className="pill pill-bare pill-neutral tnum shrink-0">
              {activityData?.totalBookings || 0} total
            </span>
          </div>

          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            <div className="h-52 sm:h-56">
              <ChartState loading={activityLoading} empty={breakdownList.length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdownList}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke={INK}
                      strokeWidth={2}
                    >
                      {breakdownList.map((_entry, index) => (
                        <Cell key={index} fill={SERIES[index % SERIES.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any, name: any, item: any) => [
                        `${val} sessions · ${item.payload.percentage}%`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartState>
            </div>

            {breakdownList.length > 0 && (
              <ul className="mt-4 pt-4 border-t border-line-soft space-y-2">
                {breakdownList.map((item, index) => (
                  <li key={item.type} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                        style={{ backgroundColor: SERIES[index % SERIES.length] }}
                      />
                      <span className="text-text truncate">{item.name}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0 tnum">
                      <span className="text-faint">{item.count}</span>
                      <span className="text-text w-9 text-right font-semibold">{item.percentage}%</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="panel lg:col-span-7 flex flex-col">
          <div className="panel-head">
            <div>
              <h2 className="display text-[16px] sm:text-[17px] text-text">Peak booking hours</h2>
              <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Bookings by hour, across 24/7 operations.</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            <div className="h-64 sm:h-72">
              <ChartState loading={peakHoursLoading} empty={(peakHours || []).length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={peakHours || []} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" vertical={false} stroke={LINE} />
                    <XAxis dataKey="label" interval={2} {...axis} tick={{ fontSize: 10, fill: MUTED }} />
                    <YAxis {...axis} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      formatter={(value: any) => [`${value} bookings`, 'That hour']}
                    />
                    <Bar dataKey="bookings" radius={[6, 6, 0, 0]}>
                      {(peakHours || []).map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.bookings >= 3 ? '#6366f1' : 'color-mix(in srgb, #6366f1 28%, var(--theme-border))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartState>
            </div>

            <div className="mt-4 pt-4 border-t border-line-soft flex flex-wrap items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                Busy (Peak) — 3 or more
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: 'color-mix(in srgb, #6366f1 28%, var(--theme-border))' }}
                />
                Regular / Off-peak
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Channel Comparison + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <section className="panel lg:col-span-4 flex flex-col">
          <div className="panel-head">
            <div>
              <h2 className="display text-[16px] sm:text-[17px] text-text">How they book</h2>
              <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Counter walk-in vs online website reservations.</p>
            </div>
          </div>

          <div className="p-4 sm:p-6 flex-1 flex flex-col">
            <div className="h-48 sm:h-52">
              <ChartState loading={trendLoading} empty={totalPeriodRevenue === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelComparison}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke={INK}
                      strokeWidth={2}
                    >
                      {channelComparison.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(val: any) => [`₨${Number(val).toLocaleString()}`, 'Revenue']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartState>
            </div>

            <ul className="mt-4 pt-4 border-t border-line-soft space-y-2">
              {channelComparison.map((item) => (
                <li key={item.name} className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="flex items-center gap-2.5">
                    <span
                      className="w-2.5 h-2.5 rounded-[2px]"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-text font-medium">{item.name}</span>
                  </span>
                  <span className="tnum">
                    <span className="text-text font-bold">₨{item.revenue.toLocaleString()}</span>
                    <span className="text-faint ml-2 font-medium">{item.percentage}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel lg:col-span-8 overflow-hidden">
          <div className="panel-head">
            <div>
              <h2 className="display text-[16px] sm:text-[17px] text-text">Top Regulars</h2>
              <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">Customers ranked by lifetime spend at ZeroOne.</p>
            </div>
          </div>

          {customersLoading ? (
            <div className="py-14 flex items-center justify-center gap-3 text-muted text-[13px]">
              <span className="spinner" />
              Loading regulars…
            </div>
          ) : (topCustomers || []).length === 0 ? (
            <div className="py-14 text-center text-[13px] text-faint">No customer records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[500px]">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th className="text-center">Sessions</th>
                    <th className="text-right">Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {(topCustomers || []).map((customer, index) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <RankBadge index={index} />
                          <span className="text-text font-semibold">{customer.name}</span>
                        </div>
                      </td>
                      <td className="tnum text-muted">{customer.phone}</td>
                      <td className="text-center tnum text-text">{customer.totalBookings}</td>
                      <td className="text-right tnum font-bold text-brass">
                        ₨{customer.totalSpend.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Top Add-ons & Café Sales Section */}
      <section className="panel">
        <div className="panel-head flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="display text-[16px] sm:text-[17px] text-text flex items-center gap-2">
              <Icon name="coffee" size={18} className="text-brass" />
              Top Café & Inventory Add-ons
            </h2>
            <p className="text-[11px] sm:text-[12px] text-muted mt-0.5">
              Items ordered with bookings and extra revenue generated.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="pill pill-bare pill-neutral text-[11px]">
              Units Sold: <strong className="text-text font-mono ml-1">{addonStats?.totalAddonUnits || 0}</strong>
            </span>
            <span className="pill pill-bare bg-brass/15 text-brass border border-brass/30 font-bold text-[11px]">
              Total Revenue: ₨{(addonStats?.totalAddonRevenue || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {addonStatsLoading ? (
            <div className="py-12 text-center text-muted">
              <span className="spinner mr-2" /> Loading top add-ons...
            </div>
          ) : !addonStats || !addonStats.topAddons || addonStats.topAddons.length === 0 ? (
            <div className="py-12 text-center text-faint border border-dashed border-line rounded-xl">
              No café or snack items ordered with bookings yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="data-table min-w-[600px]">
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-center">Units Sold</th>
                    <th className="text-right">Total Revenue</th>
                    <th className="text-right">Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {addonStats.topAddons.map((item, index) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <RankBadge index={index} />
                          <span className="text-text font-semibold">{item.name}</span>
                        </div>
                      </td>
                      <td className="text-muted text-xs">{item.category || 'Snacks'}</td>
                      <td className="text-right tnum text-muted">₨{item.price.toLocaleString()}</td>
                      <td className="text-center tnum text-text font-bold">{item.totalQuantitySold}</td>
                      <td className="text-right tnum font-bold text-brass">
                        ₨{item.totalRevenueGenerated.toLocaleString()}
                      </td>
                      <td className="text-right">
                        <span
                          className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${
                            item.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}
                        >
                          {item.isAvailable ? (item.stock !== null && item.stock !== undefined ? `${item.stock} left` : 'In Stock') : 'Out of Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
