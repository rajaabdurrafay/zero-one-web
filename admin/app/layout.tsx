import type { Metadata } from "next";
import "./globals.css";
import { getTheme } from "@/lib/api";
import { computeThemeVariables } from "@/lib/themeUtils";
import { AdminThemeProvider } from "@/context/ThemeContext";
import { AdminToaster } from "@/components/AdminToaster";

export const metadata: Metadata = {
  title: "ZeroOne Cue & Play — Admin POS & Management",
  description: "Administrative POS terminal and reservation management for ZeroOne Cue & Play Karachi",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getTheme('ADMIN');
  const themeVariables = computeThemeVariables(theme) as React.CSSProperties;

  const displayFont = theme.displayFont || 'Poppins';
  const bodyFont = theme.bodyFont || 'Inter';

  // Build the Google Fonts URL with weight ranges for both fonts
  const families = [
    `${displayFont}:wght@400;500;700;900`,
    `${bodyFont}:wght@400;500;700`,
  ];
  const googleFontsUrl = `https://fonts.googleapis.com/css2?${families
    .map((f) => `family=${encodeURIComponent(f)}`)
    .join('&')}&display=swap`;

  return (
    <html lang="en" style={themeVariables} className="h-full overflow-x-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={googleFontsUrl} rel="stylesheet" />
      </head>
      <body style={themeVariables} className="min-h-full overflow-x-hidden">
        <AdminThemeProvider initialTheme={theme}>
          {children}
          <AdminToaster />
        </AdminThemeProvider>
      </body>
    </html>
  );
}
