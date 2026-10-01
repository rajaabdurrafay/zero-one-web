"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";

export function TrustBadge() {
  return (
    <section className="py-16 bg-brand-bg border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="border border-brand-border bg-brand-surface p-8 sm:p-12 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex items-center space-x-6">
            <div className="w-14 h-14 rounded-full bg-brand-bg border border-brand-border flex items-center justify-center shrink-0">
              <Trophy className="w-7 h-7 text-brand-primary" />
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-extrabold text-brand-text-main">
                500+ Happy Gamers
              </p>
              <p className="text-sm text-brand-text-muted mt-1">
                Trusted by gamers across Karachi since 2024. Over 10,000+ hours played.
              </p>
            </div>
          </div>

          <Link
            href="/booking"
            className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-primary-hover text-white px-8 py-3.5 text-sm font-semibold transition-colors shrink-0"
          >
            Book a Slot
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
