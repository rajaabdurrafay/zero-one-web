'use client';

import Link from 'next/link';

export function LocationSection() {
  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      <div className="rounded-3xl sm:rounded-[32px] bg-brand-surface border border-brand-border p-6 sm:p-8 lg:p-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        {/* Left: Content */}
        <div className="space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1 block">
            Location & Hours
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
            Visit Us in Gulistan-e-Jauhar
          </h2>
          <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-normal">
            F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi.
            Open 24 hours a day, 7 days a week with central air conditioning and full power backup.
          </p>

          <div className="space-y-1 md:space-y-3 pt-2 text-xs text-brand-text-muted">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-semibold text-brand-text-main">Open 24/7/365</span>
              <span>— Walk-ins welcome anytime</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-brand-text-main">Phone:</span>
              <a href="tel:03712160471" className="hover:underline font-mono">
                0371-2160471
              </a>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="https://maps.google.com/?q=Kamran+Chowrangi+Gulistan-e-Jauhar+Karachi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors shadow-xs active:scale-[0.98] w-full sm:w-auto"
            >
              Get Directions
            </a>
            <Link
              href="/location"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-semibold border border-brand-border bg-brand-surface-raised hover:bg-brand-surface text-brand-text-main transition-colors w-full sm:w-auto"
            >
              Location Details
            </Link>
          </div>
        </div>

        {/* Right: Map Embed Card */}
        <div className="h-[260px] sm:h-[340px] rounded-2xl sm:rounded-3xl overflow-hidden border border-brand-border bg-brand-surface-raised relative shadow-md">
          <iframe
            title="ZeroOne Location"
            src="https://maps.google.com/maps?q=Kamran+Chowrangi+Gulistan-e-Jauhar+Karachi&t=&z=15&ie=UTF8&iwloc=&output=embed"
            className="w-full h-full border-0"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}
