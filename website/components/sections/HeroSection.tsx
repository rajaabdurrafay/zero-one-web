'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Offer } from '@/lib/api';
import { Icon } from '@/components/Icon';

interface HeroSectionProps {
  offers: Offer[];
}

export function HeroSection({ offers }: HeroSectionProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const validOffers = useMemo(() => {
    const now = new Date();
    return (offers || []).filter((offer) => {
      if (!offer.isActive) return false;
      if (offer.validFrom && new Date(offer.validFrom) > now) return false;
      if (offer.validUntil && new Date(offer.validUntil) < now) return false;
      return true;
    });
  }, [offers]);

  const activeOffer = validOffers.length > 0 ? validOffers[0] : null;

  const bookingUrl = useMemo(() => {
    if (!activeOffer) return '/book';
    const params = new URLSearchParams();
    if (activeOffer.activityId) params.set('activity', activeOffer.activityId);
    if (activeOffer.promoCode) params.set('promo', activeOffer.promoCode);
    params.set('offerId', activeOffer.id);
    return `/book?${params.toString()}`;
  }, [activeOffer]);

  const handleCopyPromo = (e: React.MouseEvent, code: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const featureTabs = [
    {
      title: 'PRO SNOOKER',
      subtitle: '3 Strachan Tables • Rs 10/min',
      href: '/activities#snooker',
      icon: 'snooker' as const,
    },
    {
      title: 'PS5 & ESPORTS',
      subtitle: '4K 120Hz • Open & VIP Suites',
      href: '/activities#ps5',
      icon: 'gamepad' as const,
    },
    {
      title: 'PRIVATE CINEMA',
      subtitle: '120" Laser • Dolby Atmos 7.1',
      href: '/activities#cinema',
      icon: 'clapperboard' as const,
    },
    {
      title: 'MOTION SIM RIG',
      subtitle: 'Direct-Drive • Hydraulic Pedals',
      href: '/activities#sim',
      icon: 'car' as const,
    },
  ];

  return (
    <section className="w-full px-3 sm:px-5 lg:px-6 pt-3 sm:pt-4 pb-6 sm:pb-8">
      {/* ── Main Rounded Hero Container Card (Finovate Reference Style) ── */}
      <div className="relative w-full rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] overflow-hidden bg-brand-surface border border-brand-border min-h-[580px] sm:min-h-[660px] lg:min-h-[720px] flex flex-col justify-between p-6 sm:p-10 lg:p-12 shadow-2xl">

        {/* Full-coverage background venue photo */}
        <Image
          src="/images/hero-banner.jpg.webp"
          alt="ZeroOne Cue and Play venue"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />

        {/* Dark gradient overlay for text contrast and depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/35 pointer-events-none" />

        {/* Top Space for Navigation Floating inside Frame */}
        <div className="relative z-10 pt-16 sm:pt-20">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/15 text-xs font-semibold text-white/90">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>24/7 OPEN • KAMRAN CHOWRANGI, KARACHI</span>
          </div>
        </div>

        {/* Middle / Center: Headline, Description & CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative z-10 max-w-2xl my-auto py-6 sm:py-8"
        >
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.05]"
          >
            Play Different.<br />
            Anytime.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-xs sm:text-sm lg:text-base text-white/80 mt-4 sm:mt-5 max-w-lg leading-relaxed font-normal"
          >
            Karachi&apos;s premier luxury entertainment lounge. Tournament-grade Strachan snooker, PS5 esports stations, 120&quot; Dolby Atmos cinema, and motion racing simulators.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center gap-3 mt-6 sm:mt-8"
          >
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-7 py-3 rounded-full text-xs sm:text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-lg transition-all active:scale-[0.98]"
            >
              Book Now
            </Link>

            <Link
              href="/activities"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full text-xs sm:text-sm font-semibold border border-white/20 bg-black/30 backdrop-blur-md text-white hover:bg-white/15 transition-colors"
            >
              Explore Activities
            </Link>
          </motion.div>

          {/* Flash Deal Slim Tag (when offer is active) */}
          {activeOffer && (
            <div className="mt-6 inline-flex flex-wrap items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 text-xs text-white">
              <Icon name="tag" size={14} className="text-brand-primary shrink-0" />
              <span className="font-bold">{activeOffer.title}</span>
              <span className="font-bold px-2 py-0.5 rounded-full bg-brand-primary text-white text-[11px]">
                {activeOffer.discountType === 'PERCENTAGE'
                  ? `${activeOffer.discountValue}% OFF`
                  : `₨${activeOffer.discountValue} OFF`}
              </span>
              {activeOffer.promoCode && (
                <button
                  type="button"
                  onClick={(e) => handleCopyPromo(e, activeOffer.promoCode!)}
                  className="font-mono text-[11px] underline text-white/80 hover:text-white cursor-pointer ml-1"
                >
                  {copiedCode ? 'Copied!' : `Use ${activeOffer.promoCode}`}
                </button>
              )}
              <Link
                href={bookingUrl}
                className="font-bold text-brand-primary hover:underline ml-1"
              >
                Apply →
              </Link>
            </div>
          )}
        </motion.div>

        {/* ── Bottom Feature Tab Cards (Finovate Reference Style) ── */}
        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-4">
          {featureTabs.map((tab, idx) => {
            const isSelected = activeTab === idx;
            return (
              <Link
                key={idx}
                href={tab.href}
                onClick={() => setActiveTab(idx)}
                className={`p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-black/40 hover:bg-black/60 backdrop-blur-md border-white/15 text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] sm:text-xs font-black tracking-wider uppercase ${
                      isSelected ? 'text-black' : 'text-white'
                    }`}
                  >
                    {tab.title}
                  </span>
                  <Icon
                    name={tab.icon}
                    size={16}
                    className={isSelected ? 'text-brand-primary' : 'text-white/70'}
                  />
                </div>
                <p
                  className={`text-[11px] sm:text-xs mt-1.5 line-clamp-1 font-medium ${
                    isSelected ? 'text-neutral-700' : 'text-white/70'
                  }`}
                >
                  {tab.subtitle}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
