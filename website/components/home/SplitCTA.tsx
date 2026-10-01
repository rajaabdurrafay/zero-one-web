"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SplitCTA() {
  return (
    <section className="py-16 sm:py-24 bg-brand-primary text-white overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left Heading */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-7"
          >
            <h2 className="display-lg text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              You'll Know Exactly What You're Booking. No Surprises.
            </h2>
          </motion.div>

          {/* Right Action */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-5 flex flex-col items-start lg:items-end justify-center space-y-4"
          >
            <p className="text-white/80 text-base max-w-sm lg:text-right">
              Transparent per-minute and hourly rates. Real-time slot status, instant WhatsApp confirmation, and zero hidden fees.
            </p>
            <Link
              href="/booking"
              className="inline-flex items-center gap-2 bg-white text-brand-primary px-8 py-4 text-sm font-bold uppercase tracking-wider hover:bg-neutral-100 transition-colors"
            >
              Book Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
