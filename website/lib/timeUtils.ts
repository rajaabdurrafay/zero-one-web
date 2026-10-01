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
 * Format HH:mm string (24h) to 12-hour AM/PM string
 * e.g., "14:05" -> "2:05 PM", "00:00" -> "12:00 AM", "13:15" -> "1:15 PM"
 */
export function formatSlot12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr || '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // 0 becomes 12
  const minStr = minute < 10 ? `0${minute}` : `${minute}`;
  return `${hour}:${minStr} ${ampm}`;
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
 * Format start and end times into a readable range.
 * If start and end span across different calendar days (midnight, month or year rollover),
 * includes the respective dates for full clarity (e.g. "Sep 19, 11:30 PM – Sep 20, 1:30 AM").
 */
export function formatDateTimeRange(startIso: string | Date, endIso: string | Date): string {
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
  fullLabel: string; // "Today, Sep 16"
}

/**
 * Generate next 7 days in Pakistan Standard Time starting from baseDate
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
 * Generate 24/7 granular time slots for a day.
 * If date is today, generates a nearest dynamic 5-minute rounded slot followed by standard grid intervals.
 * If date is in the future, generates full standard 24/7 grid.
 * @param dateStr "YYYY-MM-DD"
 * @param currentTime Date (fresh server or client time)
 * @param intervalMinutes 15 for per-minute activities (Simulator), 30 for hourly activities
 */
export function generateDayTimeSlots(
  dateStr?: string,
  currentTime: Date = new Date(),
  intervalMinutes: number = 30
): string[] {
  if (!dateStr) {
    const slots: string[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const hh = h < 10 ? `0${h}` : `${h}`;
      const mm = m < 10 ? `0${m}` : `${m}`;
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }

  // Format today's date in Pakistan timezone
  const currentPktDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(currentTime);
  const isToday = dateStr === currentPktDateStr;

  const slots: string[] = [];

  if (isToday) {
    // Extract current hour and minute in PKT
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(currentTime);

    const pktHours = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const pktMinutes = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    const currentTotalMinutes = pktHours * 60 + pktMinutes;

    // Round up to nearest 5-minute interval (e.g. 10:05 -> 10:10, 10:47 -> 10:50)
    const firstSlotMinutes = Math.ceil((currentTotalMinutes + 1) / 5) * 5;

    if (firstSlotMinutes < 24 * 60) {
      const h = Math.floor(firstSlotMinutes / 60);
      const m = firstSlotMinutes % 60;
      const hh = h < 10 ? `0${h}` : `${h}`;
      const mm = m < 10 ? `0${m}` : `${m}`;
      slots.push(`${hh}:${mm}`);
    }

    // Subsequent slots on standard fixed grid strictly after the first dynamic slot
    const nextGridStart = Math.ceil(firstSlotMinutes / intervalMinutes) * intervalMinutes;
    for (let minutes = nextGridStart; minutes < 24 * 60; minutes += intervalMinutes) {
      if (minutes > firstSlotMinutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const hh = h < 10 ? `0${h}` : `${h}`;
        const mm = m < 10 ? `0${m}` : `${m}`;
        const timeStr = `${hh}:${mm}`;
        if (!slots.includes(timeStr)) {
          slots.push(timeStr);
        }
      }
    }
  } else {
    // Future dates: Standard full 24/7 grid
    for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const hh = h < 10 ? `0${h}` : `${h}`;
      const mm = m < 10 ? `0${m}` : `${m}`;
      slots.push(`${hh}:${mm}`);
    }
  }

  return slots;
}

