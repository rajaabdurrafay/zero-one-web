"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-32 bg-brand-surface border-t border-brand-border relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="eyebrow text-brand-primary mb-4"
        >
          Your Next Session Awaits
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="display-hero text-4xl sm:text-5xl lg:text-6xl text-brand-text-main mb-6"
        >
          Ready to Play Different?
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-brand-text-muted text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed"
        >
          Book your slot now in Karachi's premier gaming lounge. Zero line-up delays, instant confirmation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <Link
            href="/booking"
            className="inline-flex items-center gap-3 bg-brand-primary hover:bg-brand-primary-hover text-white px-10 py-4 text-base font-semibold transition-all shadow-lg hover:shadow-xl"
          >
            Book Now
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
