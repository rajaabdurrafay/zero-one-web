import type { ThemeSettings } from './api';

export function getLuminance(hex: string): number {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(hex.trim())) return 0;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return 0;
  const fullHex =
    cleanHex.length === 3
      ? cleanHex.split('').map((c) => c + c).join('')
      : cleanHex;

  const r = parseInt(fullHex.substring(0, 2), 16) / 255;
  const g = parseInt(fullHex.substring(2, 4), 16) / 255;
  const b = parseInt(fullHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

export function computeThemeVariables(theme: {
  primaryColor: string;
  primaryDarkColor: string;
  accentColor: string;
  accentDarkColor: string;
  backgroundColor: string;
  textColor: string;
  displayFont?: string;
  bodyFont?: string;
  baseSizeScale?: number;
  glassEffectEnabled?: boolean;
}): Record<string, string> {
  const bgLum = getLuminance(theme.backgroundColor);
  const isLight = bgLum > 0.4;
  const isGlass = Boolean(theme.glassEffectEnabled);

  const fontVars: Record<string, string> = {
    '--font-display': `"${theme.displayFont || 'Space Grotesk'}", system-ui, sans-serif`,
    '--font-sans': `"${theme.bodyFont || 'Inter'}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`,
    '--base-size-scale': String(theme.baseSizeScale ?? 1),
  };

  const glassVars: Record<string, string> = isGlass
    ? isLight
      ? {
          '--theme-glass-enabled': '1',
          '--theme-glass-bg': `color-mix(in srgb, #ffffff 65%, transparent)`,
          '--theme-glass-bg-subtle': `color-mix(in srgb, #ffffff 50%, transparent)`,
          '--theme-glass-blur': '16px',
          '--theme-glass-nav-blur': '20px',
          '--theme-glass-modal-blur': '24px',
          '--theme-glass-border': `color-mix(in srgb, ${theme.textColor} 10%, transparent)`,
          '--theme-glass-border-light': `color-mix(in srgb, ${theme.textColor} 6%, transparent)`,
          '--theme-glass-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.05)',
          '--theme-glass-pattern': 'radial-gradient(ellipse at top left, rgba(0,0,0,0.03) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(0,0,0,0.03) 0%, transparent 60%)',
        }
      : {
          '--theme-glass-enabled': '1',
          '--theme-glass-bg': `color-mix(in srgb, ${theme.backgroundColor} 60%, transparent)`,
          '--theme-glass-bg-subtle': `color-mix(in srgb, ${theme.backgroundColor} 45%, transparent)`,
          '--theme-glass-blur': '16px',
          '--theme-glass-nav-blur': '20px',
          '--theme-glass-modal-blur': '24px',
          '--theme-glass-border': 'rgba(255, 255, 255, 0.12)',
          '--theme-glass-border-light': 'rgba(255, 255, 255, 0.08)',
          '--theme-glass-shadow': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          '--theme-glass-pattern': 'radial-gradient(ellipse at top left, rgba(255,255,255,0.04) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(255,255,255,0.03) 0%, transparent 60%)',
        }
    : {
        '--theme-glass-enabled': '0',
        '--theme-glass-bg': isLight
          ? `color-mix(in srgb, #ffffff 94%, ${theme.backgroundColor} 6%)`
          : `color-mix(in srgb, ${theme.textColor} 8%, ${theme.backgroundColor})`,
        '--theme-glass-bg-subtle': isLight
          ? `color-mix(in srgb, #ffffff 86%, ${theme.backgroundColor} 14%)`
          : `color-mix(in srgb, ${theme.textColor} 12%, ${theme.backgroundColor})`,
        '--theme-glass-blur': '0px',
        '--theme-glass-nav-blur': '0px',
        '--theme-glass-modal-blur': '0px',
        '--theme-glass-border': isLight
          ? `color-mix(in srgb, ${theme.textColor} 18%, ${theme.backgroundColor})`
          : `color-mix(in srgb, ${theme.textColor} 15%, ${theme.backgroundColor})`,
        '--theme-glass-border-light': isLight
          ? `color-mix(in srgb, ${theme.textColor} 10%, ${theme.backgroundColor})`
          : `color-mix(in srgb, ${theme.textColor} 22%, ${theme.backgroundColor})`,
        '--theme-glass-shadow': 'none',
        '--theme-glass-pattern': 'none',
      };

  if (isLight) {
    return {
      '--theme-primary': theme.primaryColor,
      '--theme-primary-dark': theme.primaryDarkColor,
      '--theme-accent': theme.accentColor,
      '--theme-accent-dark': theme.accentDarkColor,
      '--theme-bg': theme.backgroundColor,
      '--theme-text': theme.textColor,
      '--theme-surface': `color-mix(in srgb, #ffffff 94%, ${theme.backgroundColor} 6%)`,
      '--theme-surface-raised': `color-mix(in srgb, #ffffff 86%, ${theme.backgroundColor} 14%)`,
      '--theme-border': `color-mix(in srgb, ${theme.textColor} 18%, ${theme.backgroundColor})`,
      '--theme-border-light': `color-mix(in srgb, ${theme.textColor} 10%, ${theme.backgroundColor})`,
      '--theme-text-muted': `color-mix(in srgb, ${theme.textColor} 72%, ${theme.backgroundColor})`,
      ...glassVars,
      ...fontVars,
    };
  } else {
    return {
      '--theme-primary': theme.primaryColor,
      '--theme-primary-dark': theme.primaryDarkColor,
      '--theme-accent': theme.accentColor,
      '--theme-accent-dark': theme.accentDarkColor,
      '--theme-bg': theme.backgroundColor,
      '--theme-text': theme.textColor,
      '--theme-surface': `color-mix(in srgb, ${theme.textColor} 8%, ${theme.backgroundColor})`,
      '--theme-surface-raised': `color-mix(in srgb, ${theme.textColor} 12%, ${theme.backgroundColor})`,
      '--theme-border': `color-mix(in srgb, ${theme.textColor} 15%, ${theme.backgroundColor})`,
      '--theme-border-light': `color-mix(in srgb, ${theme.textColor} 22%, ${theme.backgroundColor})`,
      '--theme-text-muted': `color-mix(in srgb, ${theme.textColor} 60%, ${theme.backgroundColor})`,
      ...glassVars,
      ...fontVars,
    };
  }
}
