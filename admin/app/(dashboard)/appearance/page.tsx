'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  getTheme,
  updateTheme,
  uploadThemeLogo,
  getAdminPopupSettings,
  updateAdminPopupSettings,
  uploadPopupImage,
  type ThemeSettings,
  type SitePopupSettings,
} from '@/lib/api';
import { getLuminance } from '@/lib/themeUtils';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';

const FONT_OPTIONS = [
  { name: 'Poppins', category: 'Geometric Sans', desc: 'Clean, modern, highly legible' },
  { name: 'Inter', category: 'Workhorse Sans', desc: 'Standard UI font, ultra-crisp' },
  { name: 'Space Grotesk', category: 'Tech & Gaming', desc: 'Futuristic, bold, sharp curves' },
  { name: 'Rajdhani', category: 'Tech & Gaming', desc: 'Square, condensed, aggressive' },
  { name: 'Orbitron', category: 'Futuristic Sci-Fi', desc: 'Cyberpunk, wide stance, display heavy' },
  { name: 'Bebas Neue', category: 'Condensed Display', desc: 'Tall, narrow, impactful headlines' },
  { name: 'Oswald', category: 'Condensed Sans', desc: 'Classic punchy titles and hero banners' },
  { name: 'Montserrat', category: 'Geometric Sans', desc: 'Sophisticated, premium look' },
  { name: 'Nunito', category: 'Soft Sans', desc: 'Rounded edges, friendly, easy to read' },
  { name: 'Roboto', category: 'Neutral Sans', desc: 'Android standard, balanced' },
  { name: 'Outfit', category: 'Modern Geometric', desc: 'Smooth, sleek, versatile' },
  { name: 'Anton', category: 'Impact Display', desc: 'Ultra heavy, bold statements' },
  { name: 'Playfair Display', category: 'Editorial Serif', desc: 'Luxury, classy, high contrast' },
];

export const DEFAULT_WEBSITE_THEME_DARK: ThemeSettings = {
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

export const DEFAULT_WEBSITE_THEME_LIGHT: ThemeSettings = {
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

export const DEFAULT_ADMIN_THEME_DARK: ThemeSettings = {
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

export const DEFAULT_ADMIN_THEME_LIGHT: ThemeSettings = {
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

const DEFAULT_POPUP_STATE: SitePopupSettings = {
  isEnabled: false,
  delaySeconds: 4,
  frequency: 'ONCE_PER_SESSION',
  heading: 'Special Announcement',
  message: 'Check out our latest deals and book your gaming or snooker arena slot today!',
  buttonText: 'Book Your Slot',
  buttonLink: '/book',
  imageUrl: null,
};

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hex1);
  const lum2 = getLuminance(hex2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export default function AppearancePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkLogoInputRef = useRef<HTMLInputElement>(null);
  const lightLogoInputRef = useRef<HTMLInputElement>(null);

  const [activeTarget, setActiveTarget] = useState<'WEBSITE' | 'ADMIN'>('WEBSITE');
  const [activeMode, setActiveMode] = useState<'LIGHT' | 'DARK'>('DARK');
  const [activeSection, setActiveSection] = useState<'COLORS' | 'FONTS' | 'POPUP'>('COLORS');

  const [websiteDark, setWebsiteDark] = useState<ThemeSettings>(DEFAULT_WEBSITE_THEME_DARK);
  const [websiteLight, setWebsiteLight] = useState<ThemeSettings>(DEFAULT_WEBSITE_THEME_LIGHT);
  const [adminDark, setAdminDark] = useState<ThemeSettings>(DEFAULT_ADMIN_THEME_DARK);
  const [adminLight, setAdminLight] = useState<ThemeSettings>(DEFAULT_ADMIN_THEME_LIGHT);
  const [popupSettings, setPopupSettings] = useState<SitePopupSettings>(DEFAULT_POPUP_STATE);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDarkLogo, setUploadingDarkLogo] = useState(false);
  const [uploadingLightLogo, setUploadingLightLogo] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [webRes, admRes, popupRes] = await Promise.all([
          getTheme('WEBSITE'),
          getTheme('ADMIN'),
          getAdminPopupSettings(),
        ]);

        if (webRes) {
          if (webRes.dark) setWebsiteDark({ ...webRes.dark, mode: 'DARK', target: 'WEBSITE' });
          if (webRes.light) setWebsiteLight({ ...webRes.light, mode: 'LIGHT', target: 'WEBSITE' });
        }

        if (admRes) {
          if (admRes.dark) setAdminDark({ ...admRes.dark, mode: 'DARK', target: 'ADMIN' });
          if (admRes.light) setAdminLight({ ...admRes.light, mode: 'LIGHT', target: 'ADMIN' });
        }

        if (popupRes) {
          setPopupSettings(popupRes);
        }
      } catch (err) {
        console.error('Failed to load appearance data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const currentTheme = useMemo(() => {
    if (activeTarget === 'WEBSITE') {
      return activeMode === 'LIGHT' ? websiteLight : websiteDark;
    } else {
      return activeMode === 'LIGHT' ? adminLight : adminDark;
    }
  }, [activeTarget, activeMode, websiteLight, websiteDark, adminLight, adminDark]);

  const handleFieldChange = (key: keyof ThemeSettings, value: any) => {
    if (activeTarget === 'WEBSITE') {
      if (activeMode === 'LIGHT') {
        setWebsiteLight((prev) => ({ ...prev, [key]: value, mode: 'LIGHT' as const, target: 'WEBSITE' as const }));
      } else {
        setWebsiteDark((prev) => ({ ...prev, [key]: value, mode: 'DARK' as const, target: 'WEBSITE' as const }));
      }
    } else {
      if (activeMode === 'LIGHT') {
        setAdminLight((prev) => {
          const updated: ThemeSettings = { ...prev, [key]: value, mode: 'LIGHT' as const, target: 'ADMIN' as const };
          return updated;
        });
      } else {
        setAdminDark((prev) => {
          const updated: ThemeSettings = { ...prev, [key]: value, mode: 'DARK' as const, target: 'ADMIN' as const };
          return updated;
        });
      }
    }
  };

  const handlePopupChange = (key: keyof SitePopupSettings, value: any) => {
    setPopupSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (modeToUpload: 'DARK' | 'LIGHT', file: File) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Logo size must be less than 5MB.');
      return;
    }

    if (modeToUpload === 'DARK') {
      setUploadingDarkLogo(true);
    } else {
      setUploadingLightLogo(true);
    }
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await uploadThemeLogo(base64, activeTarget, modeToUpload);

        // Update both dark and light state objects for active target
        const logoKey = modeToUpload === 'DARK' ? 'logoUrlDark' : 'logoUrlLight';
        if (activeTarget === 'WEBSITE') {
          setWebsiteDark((prev) => ({ ...prev, [logoKey]: res.logoUrl }));
          setWebsiteLight((prev) => ({ ...prev, [logoKey]: res.logoUrl }));
        } else {
          setAdminDark((prev) => ({ ...prev, [logoKey]: res.logoUrl }));
          setAdminLight((prev) => ({ ...prev, [logoKey]: res.logoUrl }));
        }
      } catch (err: any) {
        setErrorMessage(err.message || `Failed to upload ${modeToUpload.toLowerCase()} mode logo.`);
      } finally {
        if (modeToUpload === 'DARK') {
          setUploadingDarkLogo(false);
        } else {
          setUploadingLightLogo(false);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = (modeToRemove: 'DARK' | 'LIGHT') => {
    const logoKey = modeToRemove === 'DARK' ? 'logoUrlDark' : 'logoUrlLight';
    if (activeTarget === 'WEBSITE') {
      setWebsiteDark((prev) => ({ ...prev, [logoKey]: null }));
      setWebsiteLight((prev) => ({ ...prev, [logoKey]: null }));
    } else {
      setAdminDark((prev) => ({ ...prev, [logoKey]: null }));
      setAdminLight((prev) => ({ ...prev, [logoKey]: null }));
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 5MB.');
      return;
    }

    setUploadingImage(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await uploadPopupImage(base64, file.name);
        setPopupSettings((prev) => ({ ...prev, imageUrl: res.imageUrl }));
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to upload popup image.');
      } finally {
        setUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setPopupSettings((prev) => ({ ...prev, imageUrl: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetDefaults = () => {
    if (activeSection === 'POPUP') {
      setPopupSettings(DEFAULT_POPUP_STATE);
      return;
    }

    if (activeTarget === 'WEBSITE') {
      if (activeMode === 'LIGHT') {
        setWebsiteLight(DEFAULT_WEBSITE_THEME_LIGHT);
      } else {
        setWebsiteDark(DEFAULT_WEBSITE_THEME_DARK);
      }
    } else {
      if (activeMode === 'LIGHT') {
        setAdminLight(DEFAULT_ADMIN_THEME_LIGHT);
      } else {
        setAdminDark(DEFAULT_ADMIN_THEME_DARK);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      if (activeSection === 'POPUP') {
        await updateAdminPopupSettings(popupSettings);
      } else {
        await Promise.all([
          updateTheme({ ...websiteDark, target: 'WEBSITE', mode: 'DARK' }),
          updateTheme({ ...websiteLight, target: 'WEBSITE', mode: 'LIGHT' }),
          updateTheme({ ...adminDark, target: 'ADMIN', mode: 'DARK' }),
          updateTheme({ ...adminLight, target: 'ADMIN', mode: 'LIGHT' }),
        ]);
      }

      setSaveSuccess(true);
      router.refresh();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const colorFields: {
    key: keyof ThemeSettings;
    label: string;
    description: string;
  }[] = [
    {
      key: 'primaryColor',
      label: 'Primary (buttons, nav accents)',
      description: 'Main brand color for primary buttons, active links and accents',
    },
    {
      key: 'primaryDarkColor',
      label: 'Primary — dark (hover, headings)',
      description: 'Used for hover transitions and prominent header highlights',
    },
    {
      key: 'accentColor',
      label: 'Accent (CTA, book now, highlights)',
      description: 'High-contrast color reserved for Book Now and special alerts',
    },
    {
      key: 'accentDarkColor',
      label: 'Accent — dark (hover)',
      description: 'Used for accent button hover states and subtle glow borders',
    },
    {
      key: 'backgroundColor',
      label: 'Page background',
      description: 'Overall page backdrop canvas color',
    },
    {
      key: 'textColor',
      label: 'Body text',
      description: 'Base color for titles, body paragraphs, and labels',
    },
  ];

  const contrastRatio = getContrastRatio(
    currentTheme.backgroundColor || '#000000',
    currentTheme.textColor || '#ffffff'
  );
  const isLowContrast = contrastRatio < 4.5;

  const previewFontImport = useMemo(() => {
    const disp = currentTheme.displayFont || 'Poppins';
    const body = currentTheme.bodyFont || 'Inter';
    return `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      disp
    )}:wght@400;500;700;900&family=${encodeURIComponent(
      body
    )}:wght@400;500;700&display=swap');`;
  }, [currentTheme.displayFont, currentTheme.bodyFont]);

  // Preview logo resolution
  const activeDarkLogo = activeTarget === 'WEBSITE' ? websiteDark.logoUrlDark : adminDark.logoUrlDark;
  const activeLightLogo = activeTarget === 'WEBSITE' ? websiteDark.logoUrlLight || websiteLight.logoUrlLight : adminDark.logoUrlLight || adminLight.logoUrlLight;

  if (loading) {
    return (
      <div className="p-12 text-center text-muted font-mono animate-pulse">
        Loading appearance settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">
            Appearance &amp; Themes
          </h1>
          <p className="text-[13px] text-muted mt-1">
            Customize dual Light/Dark brand logos, color palettes, custom Google fonts, and visitor site-wide popups.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary px-5 py-2 text-[13px] font-bold shadow-md cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving changes…' : activeSection === 'POPUP' ? 'Save popup settings' : 'Save all themes'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[13px] font-medium animate-in fade-in duration-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="check" size={16} />
            <span>Settings saved and applied successfully across the system!</span>
          </div>
          <span className="text-[11px] opacity-75 font-mono">Live</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[13px] font-medium animate-in fade-in duration-200 flex items-center gap-2">
          <Icon name="alert" size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-panel border border-line rounded-2xl shadow-xs">
        {/* Left Section Switchers */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-raised rounded-xl border border-line-soft">
          <button
            onClick={() => setActiveSection('COLORS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
              activeSection === 'COLORS'
                ? 'bg-panel text-text shadow-xs border border-line/60'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="sparkles" size={13} />
            <span>Colours &amp; Branding</span>
          </button>
          <button
            onClick={() => setActiveSection('FONTS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
              activeSection === 'FONTS'
                ? 'bg-panel text-text shadow-xs border border-line/60'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="file" size={13} />
            <span>Typography &amp; Fonts</span>
          </button>
          <button
            onClick={() => setActiveSection('POPUP')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-bold transition-all cursor-pointer ${
              activeSection === 'POPUP'
                ? 'bg-brass text-white shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <Icon name="bell" size={13} />
            <span>Site-Wide Popup</span>
            {popupSettings.isEnabled && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>
        </div>

        {/* Target & Mode Selectors (only for Colors & Fonts) */}
        {activeSection !== 'POPUP' && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Target Switcher */}
            <div className="flex items-center gap-1 p-1 bg-raised rounded-xl border border-line-soft">
              <button
                onClick={() => setActiveTarget('WEBSITE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  activeTarget === 'WEBSITE'
                    ? 'bg-panel text-text shadow-xs border border-line/60'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Icon name="tag" size={12} />
                <span>Website</span>
              </button>
              <button
                onClick={() => setActiveTarget('ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  activeTarget === 'ADMIN'
                    ? 'bg-panel text-text shadow-xs border border-line/60'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Icon name="settings" size={12} />
                <span>Admin</span>
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-raised rounded-xl border border-line-soft">
              <button
                onClick={() => setActiveMode('LIGHT')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  activeMode === 'LIGHT'
                    ? 'bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/40 shadow-xs font-black'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Icon name="sparkles" size={12} />
                <span>Light</span>
              </button>
              <button
                onClick={() => setActiveMode('DARK')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  activeMode === 'DARK'
                    ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/40 shadow-xs font-black'
                    : 'text-muted hover:text-text'
                }`}
              >
                <Icon name="shield" size={12} />
                <span>Dark</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-7 panel p-6 sm:p-8 space-y-6">
          {/* Section: POPUP */}
          {activeSection === 'POPUP' ? (
            <div className="space-y-6">
              {/* Top Toggle Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-raised border border-line-soft">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[16px] font-bold text-text">Site-Wide Visitor Popup</h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        popupSettings.isEnabled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-muted/15 text-muted border border-muted/30'
                      }`}
                    >
                      {popupSettings.isEnabled ? 'Active (Live)' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted leading-relaxed max-w-lg">
                    Shown once per visitor session, after a delay. Great for campaign appeals or urgent notices. Toggle off any time to hide it instantly.
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={popupSettings.isEnabled}
                    onChange={(e) => handlePopupChange('isEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brass"></div>
                </label>
              </div>

              {/* Popup Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text">Heading / Title</label>
                  <input
                    type="text"
                    value={popupSettings.heading}
                    onChange={(e) => handlePopupChange('heading', e.target.value)}
                    placeholder="Special Announcement"
                    className="field w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text">Display Delay (Seconds)</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={popupSettings.delaySeconds}
                    onChange={(e) => handlePopupChange('delaySeconds', parseInt(e.target.value) || 0)}
                    className="field w-full font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-text">Message / Description</label>
                <textarea
                  rows={3}
                  value={popupSettings.message}
                  onChange={(e) => handlePopupChange('message', e.target.value)}
                  placeholder="Check out our latest deals..."
                  className="field w-full resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text">Button Text</label>
                  <input
                    type="text"
                    value={popupSettings.buttonText}
                    onChange={(e) => handlePopupChange('buttonText', e.target.value)}
                    placeholder="Book Your Slot"
                    className="field w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-semibold text-text">Button Link (URL)</label>
                  <input
                    type="text"
                    value={popupSettings.buttonLink}
                    onChange={(e) => handlePopupChange('buttonLink', e.target.value)}
                    placeholder="/book or https://..."
                    className="field w-full font-mono text-[12px]"
                  />
                </div>
              </div>

              {/* Popup Banner Image Upload */}
              <div className="space-y-2 pt-2 border-t border-line-soft">
                <label className="text-[13px] font-semibold text-text block">Banner Image (Optional)</label>
                <p className="text-[11px] text-muted">
                  Displays above the popup title. PNG, JPG, or WebP under 5MB.
                </p>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-1">
                  {popupSettings.imageUrl ? (
                    <div className="relative group w-32 h-20 rounded-xl overflow-hidden border border-line bg-raised shadow-xs shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={popupSettings.imageUrl}
                        alt="Popup preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-20 rounded-xl border-2 border-dashed border-line-soft bg-raised/50 flex flex-col items-center justify-center text-muted gap-1 shrink-0">
                      <Icon name="image" size={20} />
                      <span className="text-[10px] font-mono">No Image</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary px-4 py-2 text-[12px] font-bold cursor-pointer disabled:opacity-50"
                    >
                      {uploadingImage ? 'Uploading…' : popupSettings.imageUrl ? 'Change image' : 'Upload image'}
                    </button>
                    {popupSettings.imageUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="text-[11px] text-rose-500 hover:underline text-left font-bold"
                      >
                        Delete current image
                      </button>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Section: COLORS & FONTS */
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-line-soft pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[18px] font-bold text-text">
                      {activeSection === 'COLORS' ? 'Brand Logos & Palette' : 'Typography & Scaling'}
                    </h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brass/10 text-brass uppercase tracking-wider">
                      {activeTarget} • {activeMode}
                    </span>
                  </div>
                  <p className="text-[12px] text-muted mt-1">
                    {activeSection === 'COLORS'
                      ? `Upload theme-aware dark/light logos and customize the ${activeMode.toLowerCase()} mode palette for the ${activeTarget === 'WEBSITE' ? 'public website' : 'admin console'}.`
                      : 'Select custom Google Fonts for headings & body paragraphs, plus adjust global scaling.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="text-[12px] text-brass hover:underline font-bold cursor-pointer"
                >
                  Reset {activeMode.toLowerCase()} defaults
                </button>
              </div>

              {/* Section 1: Color Palette & Dual Brand Logos */}
              {activeSection === 'COLORS' && (
                <div className="space-y-6">
                  {/* Brand Logos (Dark Mode + Light Mode Versions) */}
                  <div className="p-5 rounded-2xl bg-raised border border-line-soft space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Icon name="palette" size={16} className="text-brass" />
                          <h3 className="text-[14.5px] font-bold text-text">Dual Brand Logos (Theme-Aware)</h3>
                        </div>
                        <p className="text-[12px] text-muted">
                          Upload separate high-contrast logos for Dark Theme (light artwork on dark bg) and Light Theme (dark artwork on light bg).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {/* Dark Mode Logo Dropzone */}
                      <div className="p-4 rounded-xl bg-panel border border-line-soft space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span className="text-[12.5px] font-bold text-text">Dark Mode Logo</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted uppercase">On Dark BG</span>
                        </div>

                        <div className="h-24 rounded-lg bg-[#0b0b0c] border border-white/10 flex items-center justify-center p-3 relative overflow-hidden group shadow-inner">
                          {activeDarkLogo ? (
                            <img
                              src={activeDarkLogo}
                              alt="Dark Mode Logo"
                              className="max-h-16 max-w-full object-contain"
                            />
                          ) : (
                            <img
                              src="/logo.png"
                              alt="Default Dark Mode Logo"
                              className="max-h-16 max-w-full object-contain opacity-85"
                            />
                          )}
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => darkLogoInputRef.current?.click()}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white text-black rounded-md shadow-xs hover:bg-zinc-200"
                            >
                              Replace
                            </button>
                            {activeDarkLogo && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLogo('DARK')}
                                className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-md shadow-xs hover:bg-rose-700"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted font-mono truncate">
                            {activeDarkLogo ? 'Custom Uploaded' : 'System Default'}
                          </span>
                          <button
                            type="button"
                            disabled={uploadingDarkLogo}
                            onClick={() => darkLogoInputRef.current?.click()}
                            className="text-brass hover:underline font-bold cursor-pointer disabled:opacity-50"
                          >
                            {uploadingDarkLogo ? 'Uploading…' : activeDarkLogo ? 'Change logo' : 'Upload logo'}
                          </button>
                        </div>
                        <input
                          ref={darkLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload('DARK', file);
                          }}
                          className="hidden"
                        />
                      </div>

                      {/* Light Mode Logo Dropzone */}
                      <div className="p-4 rounded-xl bg-panel border border-line-soft space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="text-[12.5px] font-bold text-text">Light Mode Logo</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted uppercase">On Light BG / PDF</span>
                        </div>

                        <div className="h-24 rounded-lg bg-[#f8fafc] border border-black/10 flex items-center justify-center p-3 relative overflow-hidden group shadow-inner">
                          {activeLightLogo ? (
                            <img
                              src={activeLightLogo}
                              alt="Light Mode Logo"
                              className="max-h-16 max-w-full object-contain"
                            />
                          ) : (
                            <img
                              src="/logo-dark.png"
                              alt="Default Light Mode Logo"
                              className="max-h-16 max-w-full object-contain opacity-85"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src.indexOf('/logo.png') === -1) {
                                  target.src = '/logo.png';
                                }
                              }}
                            />
                          )}
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => lightLogoInputRef.current?.click()}
                              className="px-2.5 py-1 text-[11px] font-bold bg-white text-black rounded-md shadow-xs hover:bg-zinc-200"
                            >
                              Replace
                            </button>
                            {activeLightLogo && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLogo('LIGHT')}
                                className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 text-white rounded-md shadow-xs hover:bg-rose-700"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted font-mono truncate">
                            {activeLightLogo ? 'Custom Uploaded' : 'System Default'}
                          </span>
                          <button
                            type="button"
                            disabled={uploadingLightLogo}
                            onClick={() => lightLogoInputRef.current?.click()}
                            className="text-brass hover:underline font-bold cursor-pointer disabled:opacity-50"
                          >
                            {uploadingLightLogo ? 'Uploading…' : activeLightLogo ? 'Change logo' : 'Upload logo'}
                          </button>
                        </div>
                        <input
                          ref={lightLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLogoUpload('LIGHT', file);
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Liquid Glass Effect Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4.5 rounded-2xl bg-raised border border-line-soft">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-text">Liquid Glass Effect</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            currentTheme.glassEffectEnabled
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-muted/15 text-muted border border-muted/30'
                          }`}
                        >
                          {currentTheme.glassEffectEnabled ? 'Enabled (Translucent)' : 'Solid (Standard)'}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted leading-relaxed max-w-lg">
                        Applies a translucent, blurred glass look to cards, navbar, and panels — inspired by Apple iOS Liquid Glass design. Works in both light and dark mode.
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(currentTheme.glassEffectEnabled)}
                        onChange={(e) => handleFieldChange('glassEffectEnabled', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6.5 bg-gray-300 peer-focus:outline-hidden rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brass"></div>
                    </label>
                  </div>

                  {colorFields.map((field) => {
                    const currentColor = (currentTheme[field.key] as string) || '#000000';
                    return (
                      <div
                        key={field.key}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-xl bg-raised border border-line-soft hover:border-line transition-colors"
                      >
                        <div className="space-y-0.5 pr-2">
                          <label className="text-[13px] font-semibold text-text block">
                            {field.label}
                          </label>
                          <p className="text-[11px] text-muted">{field.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="relative w-9 h-9 rounded-xl border border-line shadow-xs overflow-hidden cursor-pointer shrink-0">
                            <div
                              className="w-full h-full"
                              style={{ backgroundColor: currentColor }}
                            />
                            <input
                              type="color"
                              value={currentColor.startsWith('#') ? currentColor.slice(0, 7) : '#000000'}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </div>

                          <input
                            type="text"
                            value={currentColor}
                            onChange={(e) => handleFieldChange(field.key, e.target.value)}
                            placeholder="#000000"
                            className="w-28 px-3 py-1.5 bg-panel border border-line rounded-lg text-text font-mono text-[12px] uppercase focus:outline-hidden focus:border-brass"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Section 2: Typography & Scaling */}
              {activeSection === 'FONTS' && (
                <div className="space-y-5">
                  {/* Display Font */}
                  <div className="p-4 rounded-xl bg-raised border border-line-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[13px] font-semibold text-text block">
                          Heading / Display Font
                        </label>
                        <p className="text-[11px] text-muted">
                          Applied to hero titles, big numbers, banner headlines and card headers
                        </p>
                      </div>
                      <span
                        style={{ fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif` }}
                        className="text-[14px] font-bold text-brass px-2.5 py-1 bg-brass/10 rounded-lg"
                      >
                        {currentTheme.displayFont || 'Poppins'}
                      </span>
                    </div>

                    <Select
                      value={currentTheme.displayFont || 'Poppins'}
                      onChange={(val) => handleFieldChange('displayFont', val)}
                      options={FONT_OPTIONS.map((f) => ({
                        value: f.name,
                        label: `${f.name} — (${f.category})`,
                        description: f.desc,
                      }))}
                    />
                  </div>

                  {/* Body Font */}
                  <div className="p-4 rounded-xl bg-raised border border-line-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[13px] font-semibold text-text block">
                          Body &amp; Interface Font
                        </label>
                        <p className="text-[11px] text-muted">
                          Applied to buttons, form inputs, navigation links, and standard paragraph text
                        </p>
                      </div>
                      <span
                        style={{ fontFamily: `"${currentTheme.bodyFont || 'Inter'}", sans-serif` }}
                        className="text-[14px] font-bold text-brass px-2.5 py-1 bg-brass/10 rounded-lg"
                      >
                        {currentTheme.bodyFont || 'Inter'}
                      </span>
                    </div>

                    <Select
                      value={currentTheme.bodyFont || 'Inter'}
                      onChange={(val) => handleFieldChange('bodyFont', val)}
                      options={FONT_OPTIONS.map((f) => ({
                        value: f.name,
                        label: `${f.name} — (${f.category})`,
                        description: f.desc,
                      }))}
                    />
                  </div>

                  {/* Global Scale Slider */}
                  <div className="p-4 rounded-xl bg-raised border border-line-soft space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[13px] font-semibold text-text block">
                          Base UI Size Scale
                        </label>
                        <p className="text-[11px] text-muted">
                          Scales the entire typography hierarchy proportionally (0.8x to 1.25x)
                        </p>
                      </div>
                      <span className="text-[13px] font-mono font-bold text-brass px-2.5 py-1 bg-brass/10 rounded-lg">
                        {Number(currentTheme.baseSizeScale || 1.0).toFixed(2)}x
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-[11px] font-mono text-muted">Compact (0.85x)</span>
                      <input
                        type="range"
                        min="0.8"
                        max="1.25"
                        step="0.05"
                        value={currentTheme.baseSizeScale || 1.0}
                        onChange={(e) => handleFieldChange('baseSizeScale', parseFloat(e.target.value))}
                        className="flex-1 accent-brass cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-muted">Spacious (1.25x)</span>
                    </div>
                  </div>
                </div>
              )}

              {isLowContrast && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-[12px] flex items-start gap-2">
                  <Icon name="alert" size={14} className="mt-0.5 shrink-0" />
                  <div><strong>Low contrast warning:</strong> The contrast ratio between your background and text color is {contrastRatio.toFixed(1)}:1 (WCAG recommends at least 4.5:1). Text may be difficult to read.</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Preview Card */}
        <div className="lg:col-span-5 space-y-4 sticky top-24">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold text-text uppercase tracking-wider">
              {activeSection === 'POPUP' ? 'Live Popup Preview' : `Live Preview • ${activeTarget} (${activeMode})`}
            </h2>
            <span className="text-[11px] font-mono text-muted">Realtime Canvas</span>
          </div>

          {/* Dynamic Google Fonts injection for preview */}
          <style dangerouslySetInnerHTML={{ __html: previewFontImport }} />

          {activeSection === 'POPUP' ? (
            /* POPUP PREVIEW CARD */
            <div className="rounded-2xl border border-line shadow-2xl p-6 bg-[#090d16] text-[#f8fafc] relative overflow-hidden clip-angled">
              {/* Fake website backdrop blur */}
              <div className="absolute inset-0 bg-brand-primary/5 pointer-events-none" />

              {/* Status Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4 text-[10px] font-mono uppercase tracking-widest text-muted">
                <span>{'// VISITOR POPUP PREVIEW'}</span>
                <span className={popupSettings.isEnabled ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                  {popupSettings.isEnabled ? '● ACTIVE' : '○ DISABLED'}
                </span>
              </div>

              {/* Realistic Modal Box */}
              <div className="relative rounded-xl border border-brand-primary/40 bg-[#0e1424] shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4">
                {/* Close Button X */}
                <div className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 text-xs font-bold cursor-pointer hover:bg-white/10">
                  <Icon name="close" size={13} />
                </div>

                {/* Optional Banner Image */}
                {popupSettings.imageUrl && (
                  <div className="w-full h-36 sm:h-44 rounded-lg overflow-hidden border border-white/10 -mt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={popupSettings.imageUrl}
                      alt="Announcement"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Heading */}
                <div className="pr-6">
                  <h3
                    style={{ fontFamily: `"${websiteDark.displayFont || 'Space Grotesk'}", sans-serif` }}
                    className="text-[20px] sm:text-[22px] font-black text-white tracking-tight leading-snug"
                  >
                    {popupSettings.heading || 'Special Announcement'}
                  </h3>
                </div>

                {/* Message */}
                <p className="text-[13px] text-zinc-300 leading-relaxed">
                  {popupSettings.message || 'Check out our latest deals and book your slot today!'}
                </p>

                {/* Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    type="button"
                    style={{
                      backgroundColor: websiteDark.primaryColor || '#8b5cf6',
                      color: getLuminance(websiteDark.primaryColor || '#8b5cf6') > 0.4 ? '#000000' : '#ffffff',
                    }}
                    className="w-full sm:flex-1 py-2.5 px-4 rounded-lg font-bold text-[13px] uppercase tracking-wider text-center shadow-lg transition-transform active:scale-95"
                  >
                    {popupSettings.buttonText || 'Book Your Slot'} →
                  </button>

                  <button
                    type="button"
                    className="w-full sm:w-auto py-2.5 px-4 rounded-lg text-[12px] font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* THEME CANVAS PREVIEW */
            <div
              className="rounded-2xl border shadow-xl p-6 transition-all duration-300 relative overflow-hidden"
              style={{
                backgroundColor: currentTheme.backgroundColor,
                backgroundImage: currentTheme.glassEffectEnabled
                  ? activeMode === 'LIGHT'
                    ? 'radial-gradient(circle at 10% 20%, rgba(200, 150, 50, 0.15), transparent 40%), radial-gradient(circle at 80% 80%, rgba(100, 100, 255, 0.15), transparent 40%)'
                    : 'radial-gradient(circle at 10% 20%, rgba(200, 150, 50, 0.25), transparent 40%), radial-gradient(circle at 80% 80%, rgba(100, 100, 255, 0.2), transparent 40%)'
                  : 'none',
                color: currentTheme.textColor,
                borderColor: `color-mix(in srgb, ${currentTheme.textColor} 18%, ${currentTheme.backgroundColor})`,
                fontFamily: `"${currentTheme.bodyFont || 'Inter'}", sans-serif`,
              }}
            >
              {/* Target & Mode Badge & Dynamic Brand Logo */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
                <div className="flex items-center gap-3">
                  <div className="h-8 max-w-[130px] flex items-center">
                    {activeMode === 'LIGHT' ? (
                      activeLightLogo || activeDarkLogo ? (
                        <img
                          src={(activeLightLogo || activeDarkLogo)!}
                          alt="Logo Preview"
                          className="max-h-7 w-auto object-contain"
                        />
                      ) : (
                        <img
                          src="/logo-dark.png"
                          alt="Logo Preview"
                          className="max-h-7 w-auto object-contain"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (target.src.indexOf('/logo.png') === -1) {
                              target.src = '/logo.png';
                            }
                          }}
                        />
                      )
                    ) : (
                      activeDarkLogo || activeLightLogo ? (
                        <img
                          src={(activeDarkLogo || activeLightLogo)!}
                          alt="Logo Preview"
                          className="max-h-7 w-auto object-contain"
                        />
                      ) : (
                        <img
                          src="/logo.png"
                          alt="Logo Preview"
                          className="max-h-7 w-auto object-contain"
                        />
                      )
                    )}
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-75">
                    {'// '} {activeTarget} MODE: {activeMode} {currentTheme.glassEffectEnabled ? '• LIQUID GLASS' : ''}
                  </span>
                </div>
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: currentTheme.primaryColor }}
                />
              </div>

              {/* Typography Preview Section */}
              <div className="space-y-4">
                <div
                  style={{
                    fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif`,
                    color: currentTheme.textColor,
                  }}
                  className="text-[28px] sm:text-[32px] font-black leading-tight tracking-tight"
                >
                  ZeroOne Cue &amp; Play
                </div>

                <p
                  style={{
                    color: `color-mix(in srgb, ${currentTheme.textColor} 75%, ${currentTheme.backgroundColor})`,
                  }}
                  className="text-[13px] leading-relaxed"
                >
                  Experience world-class snooker, private cinema pods, and cutting-edge PS5 racing simulators 24/7.
                </p>

                {/* Sample Metric Cards (with live glass effect preview) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div
                    className="p-3.5 rounded-xl border transition-all duration-300"
                    style={{
                      backgroundColor: currentTheme.glassEffectEnabled
                        ? activeMode === 'LIGHT'
                          ? 'rgba(255, 255, 255, 0.65)'
                          : 'rgba(25, 25, 30, 0.6)'
                        : `color-mix(in srgb, ${currentTheme.textColor} 6%, ${currentTheme.backgroundColor})`,
                      backdropFilter: currentTheme.glassEffectEnabled ? 'blur(16px) saturate(180%)' : 'none',
                      WebkitBackdropFilter: currentTheme.glassEffectEnabled ? 'blur(16px) saturate(180%)' : 'none',
                      borderColor: currentTheme.glassEffectEnabled
                        ? activeMode === 'LIGHT'
                          ? 'rgba(0, 0, 0, 0.08)'
                          : 'rgba(255, 255, 255, 0.12)'
                        : `color-mix(in srgb, ${currentTheme.textColor} 12%, ${currentTheme.backgroundColor})`,
                      boxShadow: currentTheme.glassEffectEnabled ? '0 8px 32px 0 rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">
                      Active Tables
                    </span>
                    <span
                      style={{
                        fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif`,
                        color: currentTheme.primaryColor,
                      }}
                      className="text-[22px] font-extrabold"
                    >
                      12 / 12
                    </span>
                  </div>

                  <div
                    className="p-3.5 rounded-xl border transition-all duration-300"
                    style={{
                      backgroundColor: currentTheme.glassEffectEnabled
                        ? activeMode === 'LIGHT'
                          ? 'rgba(255, 255, 255, 0.65)'
                          : 'rgba(25, 25, 30, 0.6)'
                        : `color-mix(in srgb, ${currentTheme.textColor} 6%, ${currentTheme.backgroundColor})`,
                      backdropFilter: currentTheme.glassEffectEnabled ? 'blur(16px) saturate(180%)' : 'none',
                      WebkitBackdropFilter: currentTheme.glassEffectEnabled ? 'blur(16px) saturate(180%)' : 'none',
                      borderColor: currentTheme.glassEffectEnabled
                        ? activeMode === 'LIGHT'
                          ? 'rgba(0, 0, 0, 0.08)'
                          : 'rgba(255, 255, 255, 0.12)'
                        : `color-mix(in srgb, ${currentTheme.textColor} 12%, ${currentTheme.backgroundColor})`,
                      boxShadow: currentTheme.glassEffectEnabled ? '0 8px 32px 0 rgba(0,0,0,0.1)' : 'none',
                    }}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 block">
                      Active Deals
                    </span>
                    <span
                      style={{
                        fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif`,
                        color: currentTheme.accentColor,
                      }}
                      className="text-[22px] font-extrabold"
                    >
                      20% OFF
                    </span>
                  </div>
                </div>

                {/* Sample Buttons */}
                <div className="pt-3 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    style={{
                      backgroundColor: currentTheme.primaryColor,
                      color: getLuminance(currentTheme.primaryColor) > 0.4 ? '#000000' : '#ffffff',
                      fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif`,
                    }}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold shadow-sm transition-transform active:scale-95"
                  >
                    Primary Action
                  </button>

                  <button
                    type="button"
                    style={{
                      backgroundColor: currentTheme.accentColor,
                      color: getLuminance(currentTheme.accentColor) > 0.4 ? '#000000' : '#ffffff',
                      fontFamily: `"${currentTheme.displayFont || 'Poppins'}", sans-serif`,
                    }}
                    className="px-4 py-2 rounded-xl text-[12px] font-bold shadow-sm transition-transform active:scale-95"
                  >
                    Book Slot →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
