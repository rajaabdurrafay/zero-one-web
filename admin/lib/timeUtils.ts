/**
 * Convert Date or YYYY-MM-DD + HH:mm into a Date object representing Pakistan Standard Time (UTC+5)
 */
export function getPKTDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  // PKT is UTC+5, so UTC hours = PKT hours - 5
  return new Date(Date.UTC(year, month - 1, day, hours - 5, minutes, 0, 0));
}

/**
 * Format ISO datetime string or Date object to 12-hour AM/PM string
 * e.g., "2:05 PM", "11:00 PM", "12:00 AM"
 */
export function formatTime12h(dateOrIso: string | Date): string {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  });
}

/**
 * Format Date to readable date string e.g., "Sep 15, 2026"
 */
export function formatDateReadable(dateOrIso: string | Date): string {
  const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
}

/**
 * Format time range in 12h.
 * If start and end span across different calendar days (midnight, month or year rollover),
 * includes the respective dates for full clarity (e.g. "Sep 19, 11:30 PM – Sep 20, 1:30 AM").
 */
export function formatTimeRange12h(startIso: string | Date, endIso: string | Date): string {
  const start = typeof startIso === 'string' ? new Date(startIso) : startIso;
  const end = typeof endIso === 'string' ? new Date(endIso) : endIso;

  const startDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(start);
  const endDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(end);

  const startTimeStr = formatTime12h(start);
  const endTimeStr = formatTime12h(end);

  if (startDateStr === endDateStr) {
    return `${startTimeStr} – ${endTimeStr}`;
  }

  const startMonthDay = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  });
  const endMonthDay = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Karachi',
  });

  return `${startMonthDay}, ${startTimeStr} – ${endMonthDay}, ${endTimeStr}`;
}

export interface Next7DaysItem {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Today", "Tomorrow", "Wed", "Thu"
  dayNumber: string; // "16"
  monthName: string; // "Sep"
  fullLabel: string; // "Today (Sep 16)"
}

/**
 * Generate strictly the next 7 days in Pakistan Standard Time (Asia/Karachi)
 */
export function getNext7Days(baseDate: Date = new Date()): Next7DaysItem[] {
  const days: Next7DaysItem[] = [];

  // Format base date in Asia/Karachi to determine today's PKT calendar date
  const basePktParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(baseDate);

  const year = Number(basePktParts.find((p) => p.type === 'year')?.value);
  const month = Number(basePktParts.find((p) => p.type === 'month')?.value);
  const day = Number(basePktParts.find((p) => p.type === 'day')?.value);

  for (let i = 0; i < 7; i++) {
    // Create date for day (UTC noon avoids boundary edge-cases)
    const targetDate = new Date(Date.UTC(year, month - 1, day + i, 12, 0, 0));
    const dateStr = targetDate.toISOString().split('T')[0];

    let dayLabel = '';
    if (i === 0) dayLabel = 'Today';
    else if (i === 1) dayLabel = 'Tomorrow';
    else {
      dayLabel = targetDate.toLocaleDateString('en-US', {
        weekday: 'short',
        timeZone: 'Asia/Karachi',
      });
    }

    const dayNumber = targetDate.toLocaleDateString('en-US', {
      day: 'numeric',
      timeZone: 'Asia/Karachi',
    });

    const monthName = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      timeZone: 'Asia/Karachi',
    });

    days.push({
      dateStr,
      dayLabel,
      dayNumber,
      monthName,
      fullLabel: `${dayLabel} (${monthName} ${dayNumber})`,
    });
  }

  return days;
}

/**
 * Calculate timeline left (%) and width (%) for a booking on a specific date (PKT).
 * Returns null if the booking does not overlap with the 24-hour window of dateStr.
 */
export function getBookingTimelinePosition(
  startTimeIso: string | Date,
  endTimeIso: string | Date,
  selectedDateStr: string
): { leftPercent: number; widthPercent: number; isOvernightStart: boolean; isOvernightEnd: boolean } | null {
  const startOfDay = getPKTDateTime(selectedDateStr, '00:00');
  const start = typeof startTimeIso === 'string' ? new Date(startTimeIso) : startTimeIso;
  const end = typeof endTimeIso === 'string' ? new Date(endTimeIso) : endTimeIso;

  const startMs = start.getTime();
  const endMs = end.getTime();
  const dayStartMs = startOfDay.getTime();
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

  if (endMs <= dayStartMs || startMs >= dayEndMs) {
    return null;
  }

  const clampedStartMs = Math.max(startMs, dayStartMs);
  const clampedEndMs = Math.min(endMs, dayEndMs);

  const startMins = (clampedStartMs - dayStartMs) / (1000 * 60);
  const endMins = (clampedEndMs - dayStartMs) / (1000 * 60);
  const durationMins = Math.max(0, endMins - startMins);

  const leftPercent = (startMins / 1440) * 100;
  const widthPercent = (durationMins / 1440) * 100;

  return {
    leftPercent,
    widthPercent,
    isOvernightStart: startMs < dayStartMs,
    isOvernightEnd: endMs > dayEndMs,
  };
}

