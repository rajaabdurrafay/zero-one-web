'use client';

import { Next7DaysItem } from '@/lib/timeUtils';

interface DateChipsSelectorProps {
  days: Next7DaysItem[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}

export default function DateChipsSelector({
  days,
  selectedDate,
  onSelectDate,
}: DateChipsSelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="field-label mb-0">Date</p>
        <span className="text-[11px] text-faint">Next 7 days</span>
      </div>

      <div className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0 snap-x">
        {days.map((day) => {
          const isSelected = selectedDate === day.dateStr;
          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => onSelectDate(day.dateStr)}
              aria-pressed={isSelected}
              className={`flex-none min-w-[64px] sm:min-w-0 snap-start p-2.5 rounded-[4px] border text-center transition-colors min-h-[64px] flex flex-col justify-between ${
                isSelected
                  ? 'bg-brass/12 border-brass text-brass'
                  : 'bg-raised border-line text-muted hover:text-text hover:border-brass-dim'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.1em]">{day.dayLabel}</span>
              <span className="display tnum block text-[20px] font-black my-0.5 leading-none">{day.dayNumber}</span>
              <span className="block text-[10px] uppercase tracking-[0.1em] opacity-70">
                {day.monthName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
