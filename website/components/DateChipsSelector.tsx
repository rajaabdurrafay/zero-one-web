'use client';

import React from 'react';
import { Next7DaysItem } from '@/lib/timeUtils';
import { Icon } from '@/components/Icon';

interface DateChipsSelectorProps {
  days: Next7DaysItem[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  theme?: 'dark' | 'light';
}

export default function DateChipsSelector({
  days,
  selectedDate,
  onSelectDate,
  theme = 'dark',
}: DateChipsSelectorProps) {
  const isDark = theme === 'dark';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          className={`block text-xs font-bold uppercase tracking-wider ${
            isDark ? 'text-brand-text-muted' : 'text-gray-700'
          }`}
        >
          Select Date *
        </label>
        <span
          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
            isDark
              ? 'text-brand-primary bg-brand-primary/10 border border-brand-primary/30'
              : 'text-blue-700 bg-blue-50 border border-blue-200'
          }`}
        >
          <Icon name="lock" size={11} />
          <span>Next 7 Days Only</span>
        </span>
      </div>

      <div className="flex sm:grid sm:grid-cols-7 gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0 snap-x">
        {days.map((day) => {
          const isSelected = selectedDate === day.dateStr;

          if (isDark) {
            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => onSelectDate(day.dateStr)}
                className={`flex-none min-w-[72px] sm:min-w-0 snap-start p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[64px] ${
                  isSelected
                    ? 'bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-accent border-brand-primary text-white shadow-md'
                    : 'bg-brand-bg border-brand-border text-brand-text-muted hover:text-brand-text-main hover:border-brand-border-light hover:bg-brand-card'
                }`}
              >
                <span className="text-[11px] font-medium opacity-90">{day.dayLabel}</span>
                <span className="text-lg font-black my-0.5 text-brand-text-main">
                  {day.dayNumber}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">
                  {day.monthName}
                </span>
              </button>
            );
          }

          // Light theme (for Admin POS)
          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => onSelectDate(day.dateStr)}
              className={`flex-none min-w-[72px] sm:min-w-0 snap-start p-2.5 sm:p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-between min-h-[64px] ${
                isSelected
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                  : 'bg-gray-50/80 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300'
              }`}
            >
              <span className={`text-[11px] font-semibold ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                {day.dayLabel}
              </span>
              <span className={`text-lg font-black my-0.5 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                {day.dayNumber}
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>
                {day.monthName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
