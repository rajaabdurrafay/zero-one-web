'use client';

import React, { createContext, useContext, useLayoutEffect, useState, useMemo } from 'react';
import type { ThemeSettings } from '@/lib/api';
import { computeThemeVariables } from '@/lib/themeUtils';

export type ThemeMode = 'LIGHT' | 'DARK';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  activeTheme: ThemeSettings;
  lightTheme: ThemeSettings;
  darkTheme: ThemeSettings;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'zeroone-theme-mode';

const DEFAULT_DARK: ThemeSettings = {
  target: 'WEBSITE',
  mode: 'DARK',
  primaryColor: '#8b5cf6',
  primaryDarkColor: '#6d28d9',
  accentColor: '#3b82f6',
  accentDarkColor: '#1d4ed8',
  backgroundColor: '#090d16',
  textColor: '#f8fafc',
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

const DEFAULT_LIGHT: ThemeSettings = {
  target: 'WEBSITE',
  mode: 'LIGHT',
  primaryColor: '#7c3aed',
  primaryDarkColor: '#6d28d9',
  accentColor: '#2563eb',
  accentDarkColor: '#1d4ed8',
  backgroundColor: '#f8fafc',
  textColor: '#0f172a',
  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeSettings;
}) {
  const lightTheme = useMemo(
    () => initialTheme?.light || (initialTheme?.mode === 'LIGHT' ? initialTheme : DEFAULT_LIGHT),
    [initialTheme]
  );
  const darkTheme = useMemo(
    () => initialTheme?.dark || (initialTheme?.mode === 'DARK' ? initialTheme : DEFAULT_DARK),
    [initialTheme]
  );

  // First client render must match SSR. Restore the saved mode before paint.
  const [mode, setModeState] = useState<ThemeMode>(initialTheme?.mode || 'DARK');

  const activeTheme = mode === 'LIGHT' ? lightTheme : darkTheme;

  const applyTheme = (theme: ThemeSettings, newMode: ThemeMode, animate = true) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    animate = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Enable smooth transition
    if (animate) root.classList.add('theme-transition');

    const vars = computeThemeVariables(theme);
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
      if (body) {
        body.style.setProperty(key, val);
      }
    });

    if (newMode === 'DARK') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    if (animate) setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
  };

  useLayoutEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let resolvedMode: ThemeMode = 'DARK';
      if (stored === 'LIGHT' || stored === 'DARK') {
        resolvedMode = stored;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        resolvedMode = 'LIGHT';
      }
      setModeState(resolvedMode);
      applyTheme(resolvedMode === 'LIGHT' ? lightTheme : darkTheme, resolvedMode, false);
    } catch {
      // ignore
    }
  }, [lightTheme, darkTheme]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // ignore
    }
    applyTheme(newMode === 'LIGHT' ? lightTheme : darkTheme, newMode);
  };

  const toggleMode = () => {
    const nextMode: ThemeMode = mode === 'DARK' ? 'LIGHT' : 'DARK';
    setMode(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark: mode === 'DARK',
        toggleMode,
        setMode,
        activeTheme,
        lightTheme,
        darkTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
