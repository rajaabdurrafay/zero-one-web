'use client';

import Link from 'next/link';

export function CTASection() {
  return (
    <section className="w-full">
      <div className="bg-brand-primary text-white py-16 sm:py-20 text-center px-4 sm:px-6 lg:px-8 border-t border-brand-border/20">
        <div className="max-w-4xl mx-auto space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-white/80 block mb-1">
            Ready to Play?
          </span>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
            Reserve Your Station in Advance.
          </h2>

          <p className="text-xs sm:text-sm text-white/90 max-w-2xl mx-auto leading-relaxed font-normal">
            Book online to hold your table or VIP gaming room, or walk in straight to our Kamran Chowrangi venue anytime 24/7.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-sm sm:max-w-none mx-auto">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold bg-white text-brand-primary hover:bg-neutral-100 transition-all shadow-md active:scale-[0.98] w-full sm:w-auto"
            >
              Book Your Slot
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors w-full sm:w-auto"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
