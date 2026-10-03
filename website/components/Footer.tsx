'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { usePathname } from 'next/navigation';
import { HomeFooter } from '@/components/redesign/HomeFooter';

export function Footer() {
  const pathname = usePathname();
  const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || 'ZeroOne Cue & Play';
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || '0371-2160471';
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'info@cueandplay.pk';
  const address = process.env.NEXT_PUBLIC_LOCATION_ADDRESS || 'F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi';
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/cueandplay.pk';
  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_URL || 'https://www.tiktok.com/@cueandplay.pk';

  if (pathname === '/') return <HomeFooter />;

  return (
    <footer className="border-t border-brand-border bg-brand-surface text-brand-text-muted mt-20 transition-colors">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-5 space-y-4">
            <Link href="/" className="inline-block flex items-center min-h-[44px] md:min-h-0">
              <BrandLogo
                width={150}
                height={45}
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-brand-text-muted max-w-sm leading-relaxed font-normal">
              Karachi&apos;s premier entertainment destination. Pro snooker tables, PS5 gaming stations, private 120&quot; laser cinema, table tennis, and motion racing rigs.
            </p>
            <div className="flex items-center gap-2 text-sm text-brand-text-main font-semibold pt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Open 24/7 in Gulistan-e-Jauhar</span>
            </div>
          </div>

          {/* Navigation Column */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-text-main">
              Explore
            </h4>
            <ul className="space-y-1 md:space-y-2.5 text-sm">
              <li>
                <Link href="/activities" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  Activities & Rates
                </Link>
              </li>
              <li>
                <Link href="/about" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  Photo Gallery
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  Customer Reviews
                </Link>
              </li>
              <li>
                <Link href="/location" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  Location & Map
                </Link>
              </li>
              <li>
                <Link href="/contact" className="flex items-center min-h-[44px] md:min-h-0 md:inline hover:text-brand-text-main transition-colors">
                  Contact & Inquiries
                </Link>
              </li>
              <li>
                <Link href="/book" className="flex items-center min-h-[44px] md:min-h-0 md:inline font-bold text-brand-text-main hover:underline">
                  Book A Slot →
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-brand-text-main">
              Contact & Hours
            </h4>
            <div className="space-y-1 md:space-y-2 text-sm leading-relaxed flex flex-col">
              <p className="text-brand-text-main font-medium py-2 md:py-0">{address}</p>
              <div className="flex items-center min-h-[44px] md:min-h-0">
                <span className="mr-2">Phone:</span>
                <a href={`tel:${phone}`} className="font-bold text-brand-text-main hover:underline font-mono inline-flex items-center min-h-[44px] md:min-h-0 px-2 -ml-2 md:px-0 md:ml-0">
                  {phone}
                </a>
              </div>
              <div className="flex items-center min-h-[44px] md:min-h-0">
                <span className="mr-2">Email:</span>
                <a href={`mailto:${email}`} className="text-brand-text-main hover:underline inline-flex items-center min-h-[44px] md:min-h-0 px-2 -ml-2 md:px-0 md:ml-0">
                  {email}
                </a>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center rounded-full text-sm md:text-xs font-semibold bg-brand-surface-raised border border-brand-border text-brand-text-main hover:bg-brand-surface transition-colors"
              >
                Instagram
              </a>
              <a
                href={tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center rounded-full text-sm md:text-xs font-semibold bg-brand-surface-raised border border-brand-border text-brand-text-main hover:bg-brand-surface transition-colors"
              >
                TikTok
              </a>
              <a
                href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-3 md:px-3 md:py-1.5 min-h-[44px] md:min-h-0 flex items-center justify-center rounded-full text-sm md:text-xs font-semibold bg-brand-surface-raised border border-brand-border text-brand-text-main hover:bg-brand-surface transition-colors"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 mt-10 border-t border-brand-border flex flex-col sm:flex-row items-center justify-between text-sm md:text-xs text-brand-text-muted gap-4 md:gap-3">
          <p className="flex items-center min-h-[44px] md:min-h-0 text-center sm:text-left">© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
          <p className="flex items-center min-h-[44px] md:min-h-0">Kamran Chowrangi, Karachi</p>
        </div>
      </div>
    </footer>
  );
}
