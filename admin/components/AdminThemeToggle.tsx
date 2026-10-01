'use client';

import React from 'react';
import { useAdminTheme } from '@/context/ThemeContext';

export function AdminThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleMode } = useAdminTheme();

  return (
    <button
      type="button"
      onClick={toggleMode}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className={`relative inline-flex items-center justify-center p-2 rounded-xl border border-line hover:border-brass text-text hover:bg-raised transition-all cursor-pointer shadow-xs ${className}`}
    >
      <div className="relative w-4.5 h-4.5 flex items-center justify-center overflow-hidden">
        {isDark ? (
          /* Sun icon (currently dark, click to switch to light) */
          <svg
            className="w-4.5 h-4.5 text-amber-400 transition-transform duration-300 hover:rotate-45"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.2}
          >
            <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity={0.25} />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
            />
          </svg>
        ) : (
          /* Moon icon (currently light, click to switch to dark) */
          <svg
            className="w-4.5 h-4.5 text-slate-700 transition-transform duration-300 hover:-rotate-12"
            fill="currentColor"
            fillOpacity={0.2}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        )}
      </div>
      <span className="sr-only">{isDark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
