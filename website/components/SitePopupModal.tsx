'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPopupSettings, type SitePopupSettings } from '@/lib/api';
import { Icon } from '@/components/Icon';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function SitePopupModal() {
  const router = useRouter();
  const [popup, setPopup] = useState<SitePopupSettings | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // For CSS opacity transition

  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function checkPopup() {
      try {
        const settings = await getPopupSettings();
        if (!settings || !settings.isEnabled) return;

        // Check Frequency rules
        if (settings.frequency === 'ONCE_PER_SESSION') {
          const sessionDismissed = sessionStorage.getItem('zeroone_popup_dismissed_session');
          if (sessionDismissed) return;
        } else if (settings.frequency === 'ONCE_PER_DAY') {
          const today = new Date().toISOString().slice(0, 10);
          const dayDismissed = localStorage.getItem('zeroone_popup_dismissed_date');
          if (dayDismissed === today) return;
        }

        setPopup(settings);

        // Wait for configured delay seconds
        const delayMs = Math.max(0, (settings.delaySeconds || 4) * 1000);
        timer = setTimeout(() => {
          setIsOpen(true);
          // slight RAF tick for smooth fade/scale transition
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        }, delayMs);
      } catch (err) {
        console.error('Error fetching site popup settings:', err);
      }
    }

    checkPopup();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const markDismissed = () => {
    if (!popup) return;
    if (popup.frequency === 'ONCE_PER_SESSION') {
      sessionStorage.setItem('zeroone_popup_dismissed_session', 'true');
    } else if (popup.frequency === 'ONCE_PER_DAY') {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('zeroone_popup_dismissed_date', today);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    markDismissed();
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    if (!popup || !popup.buttonLink) return;
    markDismissed();
    setIsVisible(false);
    setTimeout(() => {
      setIsOpen(false);
    }, 300);

    const link = popup.buttonLink.trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      router.push(link);
    }
  };

  if (!isOpen || !popup) return null;

  // Resolve image URL (prepend backend API base if relative /uploads path)
  const fullImageUrl = popup.imageUrl
    ? popup.imageUrl.startsWith('http') || popup.imageUrl.startsWith('data:')
      ? popup.imageUrl
      : `${API_BASE}${popup.imageUrl}`
    : null;

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 transition-all duration-300 ${
        isVisible ? 'bg-black/80 backdrop-blur-md opacity-100' : 'bg-transparent opacity-0'
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full max-w-lg bg-[#0c101d]/95 border border-brand-primary/40 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.3)] overflow-hidden transition-all duration-300 transform ${
          isVisible ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-4 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Glow bar */}
        <div className="h-1.5 w-full bg-linear-to-r from-brand-accent via-brand-primary to-brand-accent" />

        {/* Close Button X */}
        <button
          onClick={handleClose}
          aria-label="Close Announcement"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shadow-lg"
        >
          <Icon name="close" size={14} />
        </button>

        {/* Optional Header Banner Image */}
        {fullImageUrl && (
          <div className="w-full h-44 sm:h-52 overflow-hidden border-b border-white/10 relative bg-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullImageUrl}
              alt={popup.heading || 'Announcement'}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#0c101d] via-transparent to-transparent opacity-80" />
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-7 space-y-4 text-center sm:text-left">
          {/* Badge */}
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-brand-primary/15 text-brand-primary border border-brand-primary/30">
              <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
              Special Notice
            </span>
          </div>

          {/* Heading */}
          <h2
            style={{ fontFamily: 'var(--font-display, inherit)' }}
            className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight"
          >
            {popup.heading}
          </h2>

          {/* Message */}
          <p
            style={{ fontFamily: 'var(--font-body, inherit)' }}
            className="text-sm sm:text-base text-zinc-300 leading-relaxed font-normal whitespace-pre-line"
          >
            {popup.message}
          </p>

          {/* Actions */}
          <div className="pt-3 flex flex-col-reverse sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer text-center"
            >
              Not now
            </button>

            <button
              type="button"
              onClick={handleActionClick}
              style={{
                fontFamily: 'var(--font-display, inherit)',
              }}
              className="w-full sm:flex-1 py-3 px-6 rounded-xl font-black text-sm uppercase tracking-wider text-white bg-brand-primary hover:brightness-110 shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all transform active:scale-95 cursor-pointer text-center"
            >
              {popup.buttonText || 'Book Your Slot'} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
