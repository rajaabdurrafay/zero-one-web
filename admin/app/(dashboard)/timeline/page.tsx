'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { getTimelineData, type TimelineResource, type TimelineBooking } from '@/lib/api';
import {
  getNext7Days,
  getBookingTimelinePosition,
  formatTime12h,
  formatDateReadable,
  getPKTDateTime,
} from '@/lib/timeUtils';
import { Icon } from '@/components/Icon';

const ACTIVITY_FILTER_OPTIONS = [
  { value: '', label: 'All Arenas' },
  { value: 'SNOOKER', label: 'Snooker' },
  { value: 'PS5_OPEN', label: 'PS5 Open' },
  { value: 'PS5_PRIVATE', label: 'PS5 Private' },
  { value: 'CINEMA', label: 'Cinema' },
  { value: 'TABLE_TENNIS', label: 'Table Tennis' },
  { value: 'CAR_SIMULATOR', label: 'Car Simulator' },
];

const STATUS_COLOR_MAP: Record<string, { bg: string; border: string; text: string; label: string }> = {
  CONFIRMED: {
    bg: 'bg-[#1c4b42] dark:bg-emerald-800',
    border: 'border-[#0f2f2a] dark:border-emerald-600',
    text: 'text-white',
    label: 'Confirmed',
  },
  COMPLETED: {
    bg: 'bg-slate-700 dark:bg-slate-600',
    border: 'border-slate-800 dark:border-slate-500',
    text: 'text-white',
    label: 'Completed',
  },
  AWAITING_VERIFICATION: {
    bg: 'bg-amber-600 dark:bg-amber-700',
    border: 'border-amber-700 dark:border-amber-500',
    text: 'text-white',
    label: 'Verify Payment',
  },
  PENDING_PAYMENT: {
    bg: 'bg-orange-600 dark:bg-orange-700',
    border: 'border-orange-700 dark:border-orange-500',
    text: 'text-white',
    label: '15m Hold',
  },
  PENDING: {
    bg: 'bg-amber-600 dark:bg-amber-700',
    border: 'border-amber-700 dark:border-amber-500',
    text: 'text-white',
    label: 'Pending',
  },
};

// 24 Hour columns (00:00 to 23:00)
const HOURS_OF_DAY = Array.from({ length: 24 }, (_, i) => {
  const hour24 = i.toString().padStart(2, '0') + ':00';
  const period = i >= 12 ? 'PM' : 'AM';
  const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return {
    hourIndex: i,
    label24: hour24,
    label12: `${hour12} ${period}`,
  };
});

function VenueTimelineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Days list for the 7-day strip
  const dayTabs = useMemo(() => getNext7Days(), []);

  // Selected date state (defaults to today's PKT date)
  const initialDate = searchParams.get('date') || (dayTabs.length > 0 ? dayTabs[0].dateStr : '');
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [selectedResourceType, setSelectedResourceType] = useState<string>('');
  const [hoveredBooking, setHoveredBooking] = useState<{
    booking: TimelineBooking;
    resourceName: string;
    clientX: number;
    clientY: number;
  } | null>(null);

  // Time marker for current PKT time (if viewing today)
  const [currentMinutesInDay, setCurrentMinutesInDay] = useState<number | null>(null);

  useEffect(() => {
    function updateCurrentTimeMarker() {
      const now = new Date();
      // PKT is UTC+5
      const pktHours = (now.getUTCHours() + 5) % 24;
      const pktMinutes = now.getUTCMinutes();
      setCurrentMinutesInDay(pktHours * 60 + pktMinutes);
    }
    updateCurrentTimeMarker();
    const interval = setInterval(updateCurrentTimeMarker, 60000);
    return () => clearInterval(interval);
  }, []);

  // SWR fetch timeline data
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/timeline?date=${selectedDate}&type=${selectedResourceType}`,
    () => getTimelineData(selectedDate, selectedResourceType || undefined),
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  const resources: TimelineResource[] = data?.resources || [];

  // Summary statistics calculations
  const stats = useMemo(() => {
    let totalBookings = 0;
    let totalDurationMinutes = 0;
    const resourceBookingCounts: Record<string, { name: string; count: number }> = {};

    resources.forEach((res) => {
      resourceBookingCounts[res.id] = { name: res.name, count: res.bookings.length };
      totalBookings += res.bookings.length;

      res.bookings.forEach((b) => {
        const start = new Date(b.startTime).getTime();
        const end = new Date(b.endTime).getTime();
        const diffMins = Math.max(0, Math.round((end - start) / (1000 * 60)));
        totalDurationMinutes += diffMins;
      });
    });

    let busiestResource = 'None';
    let maxCount = 0;
    Object.values(resourceBookingCounts).forEach((item) => {
      if (item.count > maxCount) {
        maxCount = item.count;
        busiestResource = `${item.name} (${item.count} booking${item.count > 1 ? 's' : ''})`;
      }
    });

    const totalOccupiedHours = (totalDurationMinutes / 60).toFixed(1);

    return {
      totalBookings,
      busiestResource,
      totalOccupiedHours,
      activeResourceCount: resources.length,
    };
  }, [resources]);

  const isTodaySelected = dayTabs.length > 0 && selectedDate === dayTabs[0].dateStr;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-text tracking-tight display">
              Venue Timeline
            </h1>
            <span className="eyebrow px-2 py-0.5 rounded bg-line-soft text-muted font-bold">
              24-Hour View
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Visual resource occupancy, time-slot distribution, and venue bookings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/bookings" className="btn btn-ghost text-xs">
            <Icon name="calendar" size={14} />
            List View
          </Link>
          <button
            type="button"
            onClick={() => mutate()}
            className="btn btn-ghost text-xs"
            title="Refresh Timeline"
          >
            <Icon name="refresh" size={14} />
            Refresh
          </button>
          <Link href="/new-booking" className="btn btn-primary text-xs">
            <Icon name="plus" size={14} />
            New Booking
          </Link>
        </div>
      </div>

      {/* 7-Day Quick Strip & Custom Date Picker */}
      <div className="panel p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Day Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {dayTabs.map((day) => {
              const isSelected = selectedDate === day.dateStr;
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(day.dateStr)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all shrink-0 flex flex-col items-center min-w-[76px] border ${
                    isSelected
                      ? 'bg-brass text-white border-brass shadow-sm'
                      : 'bg-panel border-line text-muted hover:text-text hover:border-line-soft'
                  }`}
                >
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-85">
                    {day.dayLabel}
                  </span>
                  <span className="text-sm font-black tnum">
                    {day.monthName} {day.dayNumber}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Custom Date Input & Date Picker */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="custom-date-picker" className="text-xs font-bold text-muted whitespace-nowrap">
              Date:
            </label>
            <input
              id="custom-date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="px-3 py-2 rounded-lg bg-panel border border-line text-text text-xs font-semibold focus:outline-none focus:border-brass"
            />
          </div>
        </div>

        {/* Resource Type Filter Bar */}
        <div className="pt-3 border-t border-line-soft flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {ACTIVITY_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedResourceType(opt.value)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                  selectedResourceType === opt.value
                    ? 'bg-text text-ink border-text'
                    : 'bg-panel border-line text-muted hover:text-text'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-muted font-medium">
            Viewing: <strong className="text-text">{formatDateReadable(selectedDate)}</strong>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="panel p-3.5 space-y-1">
          <span className="eyebrow block">Total Bookings</span>
          <span className="text-2xl font-black text-text tnum block">{stats.totalBookings}</span>
          <span className="text-[11px] text-muted">Across all active arenas</span>
        </div>

        <div className="panel p-3.5 space-y-1">
          <span className="eyebrow block">Busiest Arena</span>
          <span className="text-sm font-bold text-text truncate block mt-1" title={stats.busiestResource}>
            {stats.busiestResource}
          </span>
          <span className="text-[11px] text-muted">Peak booking station</span>
        </div>

        <div className="panel p-3.5 space-y-1">
          <span className="eyebrow block">Occupied Hours</span>
          <span className="text-2xl font-black text-text tnum block">
            {stats.totalOccupiedHours} <span className="text-xs font-normal text-muted">hrs</span>
          </span>
          <span className="text-[11px] text-muted">Cumulative booked duration</span>
        </div>

        <div className="panel p-3.5 space-y-1">
          <span className="eyebrow block">Active Stations</span>
          <span className="text-2xl font-black text-text tnum block">{stats.activeResourceCount}</span>
          <span className="text-[11px] text-muted">Monitored units</span>
        </div>
      </div>

      {/* Main 24-Hour Timeline Grid Canvas */}
      <div className="panel overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-muted font-semibold text-sm">
            Loading timeline schedule for {formatDateReadable(selectedDate)}...
          </div>
        ) : error ? (
          <div className="py-16 text-center text-stop font-semibold text-sm">
            Failed to load timeline data: {error.message || 'Server error'}
          </div>
        ) : resources.length === 0 ? (
          <div className="py-16 text-center text-muted text-sm">
            No active resources configured for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[1400px]">
              {/* Header: Hour Marks */}
              <div className="flex border-b border-line bg-raised">
                {/* Left corner (Station Name Column) */}
                <div className="w-56 shrink-0 p-3 border-r border-line font-bold text-xs text-muted uppercase tracking-wider sticky left-0 bg-raised z-20">
                  Arena / Resource
                </div>

                {/* 24 Hours strip */}
                <div className="flex-1 grid grid-cols-24 relative">
                  {HOURS_OF_DAY.map((h) => (
                    <div
                      key={h.hourIndex}
                      className="text-center py-2.5 px-1 border-r border-line text-[11px] font-mono font-bold text-muted select-none"
                    >
                      <span className="block text-text">{h.label24}</span>
                      <span className="block text-[9px] text-faint font-sans font-normal">{h.label12}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource Rows */}
              <div className="divide-y divide-line">
                {resources.map((resource) => (
                  <div key={resource.id} className="flex hover:bg-raised/40 transition-colors group">
                    {/* Left Column: Resource Title */}
                    <div className="w-56 shrink-0 p-3 border-r border-line bg-panel group-hover:bg-raised/80 transition-colors sticky left-0 z-10 flex flex-col justify-center">
                      <div className="font-bold text-xs text-text truncate">{resource.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] uppercase font-bold text-muted">
                          {resource.type.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[10px] text-faint tnum">
                          • {resource.bookings.length} slot{resource.bookings.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: 24-Hour Interactive Timeline Track */}
                    <div className="flex-1 relative h-16 bg-panel">
                      {/* Background 24 Hour Vertical Grid Lines */}
                      <div className="absolute inset-0 grid grid-cols-24 pointer-events-none">
                        {HOURS_OF_DAY.map((h) => (
                          <div key={h.hourIndex} className="border-r border-line/60 h-full" />
                        ))}
                      </div>

                      {/* Red/Brass Current Time Indicator Line (If viewing today) */}
                      {isTodaySelected && currentMinutesInDay !== null && (
                        <div
                          className="absolute top-0 bottom-0 z-10 pointer-events-none flex flex-col items-center"
                          style={{ left: `${(currentMinutesInDay / 1440) * 100}%` }}
                        >
                          <div className="w-2 h-2 bg-stop rounded-full -mt-1 shadow-sm" />
                          <div className="w-[2px] h-full bg-stop" />
                        </div>
                      )}

                      {/* Render Booked Slots for this resource */}
                      {resource.bookings.map((booking) => {
                        const pos = getBookingTimelinePosition(booking.startTime, booking.endTime, selectedDate);
                        if (!pos) return null;

                        const color = STATUS_COLOR_MAP[booking.status] || STATUS_COLOR_MAP.CONFIRMED;
                        const startTimeFormatted = formatTime12h(booking.startTime);
                        const endTimeFormatted = formatTime12h(booking.endTime);

                        return (
                          <button
                            key={booking.id}
                            type="button"
                            onClick={() => router.push(`/bookings/${booking.id}`)}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredBooking({
                                booking,
                                resourceName: resource.name,
                                clientX: rect.left + rect.width / 2,
                                clientY: rect.top,
                              });
                            }}
                            onMouseLeave={() => setHoveredBooking(null)}
                            style={{
                              left: `${pos.leftPercent}%`,
                              width: `${Math.max(pos.widthPercent, 1.2)}%`,
                            }}
                            className={`absolute top-1.5 bottom-1.5 rounded-md border text-left p-1.5 shadow-sm transition-all overflow-hidden z-1 cursor-pointer hover:brightness-110 hover:ring-2 hover:ring-text flex flex-col justify-between ${color.bg} ${color.border} ${color.text}`}
                          >
                            <div className="flex items-center justify-between gap-1 leading-none">
                              <span className="font-black text-[11px] truncate block">
                                {booking.customer.name}
                              </span>
                              {booking.isWalkIn && (
                                <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-black/30 shrink-0">
                                  Walk-in
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] font-mono leading-none opacity-90 truncate mt-0.5">
                              {startTimeFormatted} - {endTimeFormatted}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Legend Footer */}
        <div className="p-3.5 bg-raised border-t border-line flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-text uppercase tracking-wider text-[11px]">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#1c4b42] dark:bg-emerald-800 border border-[#0f2f2a]" />
              <span className="text-muted text-[11px] font-medium">Confirmed / Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-600 border border-amber-700" />
              <span className="text-muted text-[11px] font-medium">Pending Verification</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-600 border border-orange-700" />
              <span className="text-muted text-[11px] font-medium">15-Minute Hold</span>
            </div>
            {isTodaySelected && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-stop inline-block" />
                <span className="text-muted text-[11px] font-medium">Current PKT Time</span>
              </div>
            )}
          </div>

          <div className="text-[11px] text-faint">
            Tip: Click any booking block to open its full details and manage session status.
          </div>
        </div>
      </div>

      {/* Hover Floating Tooltip */}
      {hoveredBooking && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white p-3 rounded-lg shadow-2xl border border-slate-700 text-xs w-64 space-y-1.5 animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${hoveredBooking.clientX}px`,
            top: `${hoveredBooking.clientY - 8}px`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-mono text-[10px] text-slate-400">
              #{hoveredBooking.booking.id.slice(-8).toUpperCase()}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-200">
              {hoveredBooking.booking.status.replace(/_/g, ' ')}
            </span>
          </div>

          <div>
            <span className="font-black text-sm block text-white">{hoveredBooking.booking.customer.name}</span>
            <span className="text-[11px] text-slate-400 block font-mono">{hoveredBooking.booking.customer.phone}</span>
          </div>

          <div className="pt-1 text-[11px] text-slate-300 space-y-0.5 border-t border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Arena:</span>
              <span className="font-semibold text-white">{hoveredBooking.resourceName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Time:</span>
              <span className="font-mono text-emerald-400 font-bold">
                {formatTime12h(hoveredBooking.booking.startTime)} - {formatTime12h(hoveredBooking.booking.endTime)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount:</span>
              <span className="font-mono text-white font-bold">
                ₨{hoveredBooking.booking.totalPrice.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VenueTimelinePage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-muted">Loading timeline...</div>}>
      <VenueTimelineContent />
    </Suspense>
  );
}
