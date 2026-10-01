'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

export function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Choose Activity',
      desc: 'Browse Snooker, PS5, Cinema, Table Tennis, or Simulators and select your station.',
      highlight: false,
    },
    {
      num: '02',
      title: 'Book Your Slot',
      desc: 'Pick your preferred start time and duration. Receive instant holding verification.',
      highlight: true,
    },
    {
      num: '03',
      title: 'Show Up & Play',
      desc: 'Arrive at Kamran Chowrangi. Your station is ready and reserved with zero wait time.',
      highlight: false,
    },
  ];

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      {/* Section Header - Left-aligned to match all other sections */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1 block">
          Simple Process
        </span>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
          How It Works
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step, i) => (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.15 * i }}
            key={i}
            className={`p-6 sm:p-8 rounded-3xl flex flex-col justify-between transition-all ${
              step.highlight
                ? 'bg-brand-primary text-white shadow-md'
                : 'bg-brand-surface border border-brand-border text-brand-text-main'
            }`}
          >
            <div>
              <div
                className={`text-xs font-mono font-black ${
                  step.highlight ? 'text-white/60' : 'text-brand-text-muted'
                }`}
              >
                {step.num}
              </div>
              <h3
                className={`text-lg sm:text-xl font-bold mt-4 ${
                  step.highlight ? 'text-white' : 'text-brand-text-main'
                }`}
              >
                {step.title}
              </h3>
              <p
                className={`text-xs sm:text-sm mt-2 leading-relaxed ${
                  step.highlight ? 'text-white/80' : 'text-brand-text-muted'
                }`}
              >
                {step.desc}
              </p>
            </div>

            <div className="mt-8 pt-4">
              {step.highlight ? (
                <Link
                  href="/book"
                  className="inline-flex items-center gap-2 text-xs font-bold text-white hover:underline"
                >
                  <span>Reserve Online</span>
                  <span>→</span>
                </Link>
              ) : (
                <div className="text-xs font-semibold text-brand-text-muted flex items-center">
                  Step {step.num} of 03
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
