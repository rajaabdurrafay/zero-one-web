'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { ThemeSettings } from '@/lib/api';
import { computeThemeVariables } from '@/lib/themeUtils';

export type ThemeMode = 'LIGHT' | 'DARK';

interface AdminThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
  setMode: (mode: ThemeMode) => void;
  activeTheme: ThemeSettings;
  lightTheme: ThemeSettings;
  darkTheme: ThemeSettings;
  updateLocalTheme: (updatedTheme: ThemeSettings) => void;
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

const STORAGE_KEY = 'zeroone-admin-theme-mode';

const DEFAULT_ADMIN_DARK: ThemeSettings = {
  target: 'ADMIN',
  mode: 'DARK',
  primaryColor: '#c9a84c',
  primaryDarkColor: '#e0c069',
  accentColor: '#6366f1',
  accentDarkColor: '#4338ca',
  backgroundColor: '#0b0b0c',
  textColor: '#ededeb',
  displayFont: 'Poppins',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

const DEFAULT_ADMIN_LIGHT: ThemeSettings = {
  target: 'ADMIN',
  mode: 'LIGHT',
  primaryColor: '#b48c36',
  primaryDarkColor: '#8a6518',
  accentColor: '#4f46e5',
  accentDarkColor: '#3730a3',
  backgroundColor: '#fbfaf6',
  textColor: '#1e1e24',
  displayFont: 'Poppins',
  bodyFont: 'Inter',
  baseSizeScale: 1.0,
  glassEffectEnabled: false,
  logoUrlDark: null,
  logoUrlLight: null,
};

export function AdminThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: ThemeSettings;
}) {
  const [lightTheme, setLightTheme] = useState<ThemeSettings>(() => {
    return initialTheme?.light || (initialTheme?.mode === 'LIGHT' ? initialTheme : DEFAULT_ADMIN_LIGHT);
  });

  const [darkTheme, setDarkTheme] = useState<ThemeSettings>(() => {
    return initialTheme?.dark || (initialTheme?.mode === 'DARK' ? initialTheme : DEFAULT_ADMIN_DARK);
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return initialTheme?.mode || 'DARK';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'LIGHT' || stored === 'DARK') return stored;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'LIGHT';
      }
    } catch {
      // ignore
    }
    return 'DARK';
  });

  const activeTheme = mode === 'LIGHT' ? lightTheme : darkTheme;

  const applyTheme = (theme: ThemeSettings) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    root.classList.add('theme-transition');

    const vars = computeThemeVariables(theme);
    Object.entries(vars).forEach(([key, val]) => {
      if (val) {
        root.style.setProperty(key, val);
        if (body) {
          body.style.setProperty(key, val);
        }
      }
    });

    if (theme.mode === 'DARK' || (!theme.mode && mode === 'DARK')) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 300);
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let resolvedMode: ThemeMode = 'DARK';
      if (stored === 'LIGHT' || stored === 'DARK') {
        resolvedMode = stored;
      } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        resolvedMode = 'LIGHT';
      }
      setModeState(resolvedMode);
      applyTheme(resolvedMode === 'LIGHT' ? lightTheme : darkTheme);
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
    applyTheme(newMode === 'LIGHT' ? lightTheme : darkTheme);
  };

  const toggleMode = () => {
    const nextMode: ThemeMode = mode === 'DARK' ? 'LIGHT' : 'DARK';
    setMode(nextMode);
  };

  const updateLocalTheme = (updatedTheme: ThemeSettings) => {
    if (updatedTheme.mode === 'LIGHT') {
      setLightTheme(updatedTheme);
    } else {
      setDarkTheme(updatedTheme);
    }
    if (updatedTheme.mode === mode) {
      applyTheme(updatedTheme);
    }
  };

  return (
    <AdminThemeContext.Provider
      value={{
        mode,
        isDark: mode === 'DARK',
        toggleMode,
        setMode,
        activeTheme,
        lightTheme,
        darkTheme,
        updateLocalTheme,
      }}
    >
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within an AdminThemeProvider');
  }
  return context;
}
