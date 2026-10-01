'use client';

import React from 'react';
import Image from 'next/image';
import { useTheme } from '@/context/ThemeContext';

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
  forceMode?: 'DARK' | 'LIGHT';
  priority?: boolean;
}

export function BrandLogo({
  className = 'h-8 sm:h-9 w-auto object-contain',
  width = 140,
  height = 40,
  alt = 'ZeroOne Cue & Play',
  forceMode,
  priority = false,
}: BrandLogoProps) {
  const { mode, activeTheme, lightTheme, darkTheme } = useTheme();

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
      <img
        src={finalCustomLogo}
        alt={alt}
        className={className}
        style={{ maxWidth: '100%', objectFit: 'contain' }}
      />
    );
  }

  // Default fallback static logos
  return (
    <>
      {/* Dark logo for Light Theme */}
      <Image
        src="/logo-dark.png"
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLight ? 'block' : 'hidden'}`}
        priority={priority}
      />
      {/* Light logo for Dark Theme */}
      <Image
        src="/logo.png"
        alt={alt}
        width={width}
        height={height}
        className={`${className} ${isLight ? 'hidden' : 'block'}`}
        priority={priority}
      />
    </>
  );
}
