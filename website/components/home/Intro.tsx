"use client";

import { motion } from "framer-motion";

export function IntroSection() {
  const points = [
    {
      num: "01",
      title: "State-of-the-Art Gear",
      desc: "From professional-tier snooker tables to latest-gen consoles and dynamic racing rigs, every corner is engineered for perfection."
    },
    {
      num: "02",
      title: "Exclusive Private Spaces",
      desc: "Private rooms for PS5 gaming and private mini-cinema screenings let you enjoy uninterrupted sessions with friends."
    },
    {
      num: "03",
      title: "Seamless Real-time Booking",
      desc: "Zero queues and transparent hourly rates. Choose your slot online, walk in, and immediately start playing."
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-bg border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="max-w-3xl mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="eyebrow text-brand-primary mb-3"
          >
            Who We Are
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
          >
            Founded to Redefine Karachi's Gaming Scene
          </motion.h2>
        </div>

        {/* 3-Column Numbered List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 sm:gap-8">
          {points.map((point, index) => (
            <motion.div
              key={point.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * index }}
              className="flex flex-col border-t border-brand-border pt-6"
            >
              <span className="font-mono text-xl sm:text-2xl text-brand-primary mb-4 font-semibold">
                {point.num}
              </span>
              <h3 className="text-xl font-bold text-brand-text-main mb-2">
                {point.title}
              </h3>
              <p className="text-brand-text-muted leading-relaxed text-sm sm:text-base">
                {point.desc}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
