'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';
import { getAttendanceLogs, getStaffMembers, AttendanceLog, StaffMember } from '@/lib/api';
import { PageContainer } from '@/components/Card';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatTime(isoString?: string | null) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-PK', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatDuration(minutes?: number | null, isOngoing?: boolean) {
  if (isOngoing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Ongoing Shift
      </span>
    );
  }
  if (minutes === undefined || minutes === null) return '—';

  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs === 0) {
    return <span className="font-mono text-xs text-text">{mins}m</span>;
  }
  return (
    <span className="font-mono text-xs text-text">
      {hrs}h {mins}m
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'SUPER_ADMIN') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <Icon name="shield" size={10} />
        Super Admin
      </span>
    );
  }
  if (role === 'MANAGER') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
        <Icon name="user" size={10} />
        Manager
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <Icon name="play" size={10} />
      Receptionist
    </span>
  );
}

export default function AttendancePage() {
  const [clockTime, setClockTime] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClockTime(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<string>('THIS_WEEK');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Fetch all staff members for dropdown
  const { data: staffList } = useSWR<StaffMember[]>('staff-members-list', () => getStaffMembers());

  // Calculate start and end date based on dateFilterMode
  const dateRange = useMemo(() => {
    const now = new Date();
    if (dateFilterMode === 'TODAY') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return {
        startDate: today.toISOString(),
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString(),
      };
    }
    if (dateFilterMode === 'THIS_WEEK') {
      const d = new Date(now);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return {
        startDate: monday.toISOString(),
        endDate: new Date().toISOString(),
      };
    }
    if (dateFilterMode === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: firstDay.toISOString(),
        endDate: new Date().toISOString(),
      };
    }
    if (dateFilterMode === 'CUSTOM') {
      return {
        startDate: customStartDate ? new Date(customStartDate).toISOString() : undefined,
        endDate: customEndDate ? new Date(customEndDate).toISOString() : undefined,
      };
    }
    return {};
  }, [dateFilterMode, customStartDate, customEndDate]);

  // Fetch attendance logs
  const { data: attendanceData, error, isLoading, mutate } = useSWR<AttendanceLog[]>(
    ['admin-attendance-logs', selectedStaffId, dateRange.startDate, dateRange.endDate],
    () =>
      getAttendanceLogs({
        staffId: selectedStaffId !== 'ALL' ? selectedStaffId : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      }),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  const logs = attendanceData || [];

  // Summary statistics
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const uniqueDays = new Set<string>();
    let ongoingCount = 0;

    logs.forEach((log) => {
      if (log.durationMinutes !== null && log.durationMinutes !== undefined) {
        totalMinutes += log.durationMinutes;
      } else if (!log.logoutAt) {
        ongoingCount += 1;
        // Calculate rough elapsed minutes for ongoing
        const diffMs = clockTime - new Date(log.loginAt).getTime();
        totalMinutes += Math.max(0, Math.floor(diffMs / (1000 * 60)));
      }

      if (log.date) {
        uniqueDays.add(new Date(log.date).toDateString());
      }
    });

    const hours = (totalMinutes / 60).toFixed(1);

    return {
      totalHours: hours,
      daysPresent: uniqueDays.size,
      totalShifts: logs.length,
      ongoingCount,
    };
  }, [logs, clockTime]);

  const staffOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'All Staff Members' }];
    if (Array.isArray(staffList)) {
      staffList.forEach((s) => {
        opts.push({
          value: s.id,
          label: `${s.name} (@${s.username})`,
        });
      });
    }
    return opts;
  }, [staffList]);

  const dateFilterOptions = [
    { value: 'TODAY', label: 'Today' },
    { value: 'THIS_WEEK', label: 'This Week' },
    { value: 'THIS_MONTH', label: 'This Month' },
    { value: 'ALL', label: 'All Time' },
    { value: 'CUSTOM', label: 'Custom Range' },
  ];

  return (
    <PageContainer className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel border border-line p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brass/10 border border-brass/30 flex items-center justify-center text-brass">
              <Icon name="clock" size={18} />
            </div>
            <h2 className="text-xl font-bold text-text">Staff Attendance & Shift Logs</h2>
          </div>
          <p className="text-xs text-muted mt-1">
            Track staff duty cycles, shift durations, login/logout timings, and accountability.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => mutate()}
            className="btn btn-subtle text-xs flex items-center gap-2 py-2 px-3.5"
            title="Refresh Attendance Logs"
          >
            <Icon name="refresh" size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Total Hours Logged
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text tracking-tight font-mono">
              {stats.totalHours}
            </span>
            <span className="text-xs text-muted">hrs</span>
          </div>
        </div>

        <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Days Present
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-400 tracking-tight font-mono">
              {stats.daysPresent}
            </span>
            <span className="text-xs text-muted">active days</span>
          </div>
        </div>

        <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Total Shift Sessions
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-text tracking-tight font-mono">
              {stats.totalShifts}
            </span>
            <span className="text-xs text-muted">logins</span>
          </div>
        </div>

        <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
            Currently On Duty
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-brass tracking-tight font-mono">
              {stats.ongoingCount}
            </span>
            <span className="text-xs text-muted">staff active</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-panel border border-line p-4 rounded-2xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Staff Filter Dropdown */}
        <div>
          <Select
            label="Filter Staff"
            value={selectedStaffId}
            onChange={(val) => setSelectedStaffId(val)}
            options={staffOptions}
            size="md"
          />
        </div>

        {/* Date Filter Dropdown */}
        <div>
          <Select
            label="Date Range"
            value={dateFilterMode}
            onChange={(val) => setDateFilterMode(val)}
            options={dateFilterOptions}
            size="md"
          />
        </div>

        {/* Custom Date Range Picker (shown when CUSTOM selected) */}
        {dateFilterMode === 'CUSTOM' ? (
          <div className="flex items-center gap-2 pt-5">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full bg-raised border border-line rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-brass"
            />
            <span className="text-muted text-xs">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full bg-raised border border-line rounded-xl px-3 py-2 text-xs text-text outline-none focus:border-brass"
            />
          </div>
        ) : (
          <div className="flex items-center pt-6 text-xs text-muted font-mono">
            {dateFilterMode === 'TODAY' && 'Showing shifts recorded today'}
            {dateFilterMode === 'THIS_WEEK' && 'Showing shifts from current calendar week'}
            {dateFilterMode === 'THIS_MONTH' && 'Showing shifts from current calendar month'}
            {dateFilterMode === 'ALL' && 'Showing all historical attendance logs'}
          </div>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-panel border border-line rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-line bg-subtle/50 text-muted font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Staff Member</th>
                <th className="py-3.5 px-4">Login Time</th>
                <th className="py-3.5 px-4">Logout Time</th>
                <th className="py-3.5 px-4">Shift Duration</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="refresh" size={20} className="animate-spin text-brass" />
                      <span>Loading attendance records...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-rose-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="alert" size={20} />
                      <span>Failed to load attendance records. Super Admin access required.</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Icon name="clock" size={24} className="text-muted/40" />
                      <span>No attendance records found for this period/filter.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isOngoing = !log.logoutAt;
                  const avatarSrc = log.adminUser?.avatarUrl
                    ? log.adminUser.avatarUrl.startsWith('http')
                      ? log.adminUser.avatarUrl
                      : `${API_BASE}${log.adminUser.avatarUrl}`
                    : null;

                  return (
                    <tr key={log.id} className="hover:bg-raised/60 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-muted">
                        {formatDate(log.loginAt)}
                      </td>

                      {/* Staff Member */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={log.adminUser?.name || 'Staff'}
                              className="w-7 h-7 rounded-full object-cover border border-line shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-brass/15 text-brass border border-brass/30 flex items-center justify-center font-bold text-[11px] shrink-0">
                              {(log.adminUser?.name || 'S').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-text truncate">
                              {log.adminUser?.name || 'Unknown Staff'}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-muted font-mono">
                                @{log.adminUser?.username || 'unknown'}
                              </span>
                              {log.adminUser?.role && <RoleBadge role={log.adminUser.role} />}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Login Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-emerald-400">
                        {formatTime(log.loginAt)}
                      </td>

                      {/* Logout Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-muted">
                        {formatTime(log.logoutAt)}
                      </td>

                      {/* Shift Duration */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {formatDuration(log.durationMinutes, isOngoing)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isOngoing ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold font-mono uppercase bg-neutral-500/15 text-neutral-400 border border-neutral-500/30">
                            COMPLETED
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer row */}
        <div className="p-3.5 bg-subtle/30 border-t border-line flex items-center justify-between text-xs text-muted">
          <span>Showing {logs.length} shift attendance records</span>
          <span className="font-mono text-[11px]">Auto-updates every 10s</span>
        </div>
      </div>
    </PageContainer>
  );
}
