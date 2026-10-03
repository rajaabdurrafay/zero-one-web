'use client';

import React from 'react';
import Image from 'next/image';
import { useAdminTheme } from '@/context/ThemeContext';

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  forceMode?: 'DARK' | 'LIGHT';
  priority?: boolean;
}

export function BrandLogo({
  className = 'h-8 w-auto object-contain',
  width = 140,
  height = 40,
  alt = 'ZeroOne Cue & Play',
  forceMode,
  priority = false,
}: BrandLogoProps) {
  const { mode, activeTheme, lightTheme, darkTheme } = useAdminTheme();

  const currentMode = forceMode || mode;
  const isLight = currentMode === 'LIGHT';

  // Resolved theme object based on effective mode
  const currentThemeObj = isLight ? lightTheme : darkTheme;
  const oppositeThemeObj = isLight ? darkTheme : lightTheme;

  // Custom logo priority: mode-specific custom logo -> opposite mode custom logo -> default static logo
  const customLogoForMode = isLight
    ? (currentThemeObj?.logoUrlLight || currentThemeObj?.logoUrlDark)
    : (currentThemeObj?.logoUrlDark || currentThemeObj?.logoUrlLight);

  const finalCustomLogo = customLogoForMode || oppositeThemeObj?.logoUrlDark || oppositeThemeObj?.logoUrlLight;

  if (finalCustomLogo) {
    return (
      <Image
        width={width} height={height} priority={priority}
        src={finalCustomLogo.startsWith('/uploads/') ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')+finalCustomLogo:finalCustomLogo}
        alt={alt}
        className={className}
        style={{ maxWidth: '100%', objectFit: 'contain' }}
      />
    );
  }

  // Default fallback static logos
  const defaultSrc = isLight ? '/logo-dark.png' : '/logo.png';

  return (
    <Image
      src={defaultSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
      onError={(e) => {
        // Fallback to /logo.png if /logo-dark.png fails to load in dev
        const target = e.currentTarget;
        if (target.src.indexOf('/logo.png') === -1) {
          target.src = '/logo.png';
        }
      }}
    />
  );
}
