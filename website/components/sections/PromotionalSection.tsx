'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Offer } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Resolve a backend image path to a full URL (prepend API_BASE for /uploads/ paths). */
function resolveImageUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`;
  return url;
}

interface PromotionalSectionProps {
  offers: Offer[];
}

export function PromotionalSection({ offers }: PromotionalSectionProps) {
  const activeOffer = offers.find((o) => o.isActive);

  const bannerImage = activeOffer?.bannerImageUrl
    ? resolveImageUrl(activeOffer.bannerImageUrl)
    : '/images/Snokker/snooker-table.jpg (7).webp';

  return (
    <section className="w-full py-12 sm:py-16 bg-brand-surface/50 border-y border-brand-border/40">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Left: Visual Container */}
          <div className="h-[260px] sm:h-[340px] rounded-3xl bg-brand-surface-raised border border-brand-border relative overflow-hidden shadow-md">
            <Image
              fill
              className="object-cover"
              src={bannerImage}
              alt={activeOffer?.title || 'ZeroOne Snooker Hall'}
              sizes="(max-width: 1024px) 100vw, 50vw"
              unoptimized={bannerImage.includes('/uploads/')}
            />
            <span className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full bg-brand-surface/90 backdrop-blur-md border border-brand-border text-brand-text-main z-10">
              24/7 RESERVED
            </span>
          </div>

          {/* Right: Info */}
          <div className="space-y-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1 block">
                Exclusive Experience
              </span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
                {activeOffer ? activeOffer.title : 'Level Up Your Squad Nights'}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-normal max-w-lg">
              {activeOffer?.description ||
                'Whether you are setting up a private 85" 4K OLED gaming session, booking a 120" Atmos cinema room, or challenging friends on tournament snooker cloth, ZeroOne delivers zero latency and luxury comfort.'}
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Link
                href={activeOffer?.promoCode ? `/book?promo=${activeOffer.promoCode}` : '/book'}
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors shadow-md active:scale-[0.98] w-full sm:w-auto"
              >
                Book Station
              </Link>
              <Link
                href="/activities"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-semibold border border-brand-border bg-brand-surface-raised hover:bg-brand-surface text-brand-text-main transition-colors w-full sm:w-auto"
              >
                View Rates
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
