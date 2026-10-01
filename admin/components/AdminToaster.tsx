'use client';

import { Toaster as HotToaster } from 'react-hot-toast';

export function AdminToaster() {
  return (
    <HotToaster
      position="top-right"
      containerStyle={{
        top: 20,
        right: 20,
        zIndex: 999999,
      }}
      toastOptions={{
        duration: 4500,
        style: {
          background: 'var(--theme-surface, #ffffff)',
          color: 'var(--theme-text, #0d1f1b)',
          border: '1px solid var(--theme-border, #e5e0d3)',
          borderRadius: '0.75rem',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: '12px 16px',
        },
        success: {
          iconTheme: {
            primary: '#2d8054',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#b83d3b',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}
