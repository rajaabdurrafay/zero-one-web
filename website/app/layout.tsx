import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SitePopupModal } from '@/components/SitePopupModal';
import { CustomerAuthProvider } from '@/context/CustomerAuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { SystemStatusProvider } from '@/components/SystemStatusProvider';
import { getTheme, getSystemSettings } from '@/lib/api';
import { computeThemeVariables } from '@/lib/themeUtils';

export const metadata: Metadata = {
  title: "ZeroOne Cue & Play — Karachi's Premium Gaming Lounge & Snooker Club",
  description: "Karachi's premier snooker lounge, PS5 gaming hall, private cinema, table tennis & car simulator — open 24/7 at Kamran Chowrangi, Gulistan-e-Jauhar.",
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

  const families = [
    `${displayFont}:wght@400;500;700;900`,
    `${bodyFont}:wght@400;500;700`,
  ];
  const googleFontsUrl = `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${encodeURIComponent(f)}`)
    .join('&')}&display=swap`;

  const themeVariables = computeThemeVariables(theme) as React.CSSProperties;

  return (
    <html lang="en" className="overflow-x-hidden" style={{ ...themeVariables, scrollBehavior: 'smooth' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={googleFontsUrl} rel="stylesheet" />
      </head>
      <body
        style={themeVariables}
        className="flex flex-col min-h-screen bg-brand-bg text-brand-text-main antialiased overflow-x-hidden"
      >
        <SystemStatusProvider initialSettings={systemSettings}>
          <ThemeProvider initialTheme={theme}>
            <CustomerAuthProvider>
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
              <SitePopupModal />
            </CustomerAuthProvider>
          </ThemeProvider>
        </SystemStatusProvider>
      </body>
    </html>
  );
}
