import type { Metadata } from 'next';
import './globals.css';
import { CustomerPageShell } from '@/components/redesign/CustomerPageShell';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SitePopupModal } from '@/components/SitePopupModal';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SystemStatusProvider } from '@/components/SystemStatusProvider';
import { getTheme, getSystemSettings } from '@/lib/api';
import { computeThemeVariables } from '@/lib/themeUtils';
import { bodyFont as optimizedBodyFont, headingFont } from './fonts';

export const metadata: Metadata = {
  title: "ZeroOne Cue & Play — Karachi's Premium Gaming Lounge & Snooker Club",
  description: "Snooker, PS5 gaming, private cinema, table tennis and car simulator sessions at ZeroOne Cue & Play, Gulistan-e-Jauhar, Karachi.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [theme, systemSettings] = await Promise.all([
    getTheme('WEBSITE'),
    getSystemSettings(),
  ]);

  const displayFont = theme.displayFont || 'Space Grotesk';
  const bodyFont = theme.bodyFont || 'Inter';

  const families = [...new Set([displayFont, bodyFont, theme.light?.displayFont, theme.light?.bodyFont, theme.dark?.displayFont, theme.dark?.bodyFont])].filter((name): name is string => Boolean(name) && name !== 'Inter' && name !== 'Space Grotesk').map(name => `${name}:wght@400;500;700`);
  const googleFontsUrl = families.length ? `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${encodeURIComponent(f)}`)
    .join('&')}&display=swap` : null;

  const themeVariables = computeThemeVariables(theme) as React.CSSProperties;

  return (
    <html lang="en" className={`overflow-x-hidden ${optimizedBodyFont.variable} ${headingFont.variable}`} style={{ ...themeVariables, scrollBehavior: 'smooth' }}>
      <head>
        {googleFontsUrl && <><link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={googleFontsUrl} rel="stylesheet" /></>}
      </head>
      <body
        style={themeVariables}
        className="flex flex-col min-h-screen bg-brand-bg text-brand-text-main antialiased overflow-x-hidden"
      >
        <SystemStatusProvider initialSettings={systemSettings}>
          <ThemeProvider initialTheme={theme}>
            <CustomerAuthProvider>
              <Navbar />
              <main id="main-content" tabIndex={-1} className="flex-1"><CustomerPageShell>{children}</CustomerPageShell></main>
              <Footer />
              <SitePopupModal />
            </CustomerAuthProvider>
          </ThemeProvider>
        </SystemStatusProvider>
      </body>
    </html>
  );
}
