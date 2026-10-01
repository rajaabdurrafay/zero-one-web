"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Zap, Clock, Trophy } from "lucide-react";

export function ValuesGrid() {
  const values = [
    {
      icon: Trophy,
      title: "Uncompromising Quality",
      desc: "Top-tier tournament tables, original high-refresh 4K gaming screens, and certified racing simulator cockpits."
    },
    {
      icon: ShieldCheck,
      title: "Safe & Premium Space",
      desc: "Family-friendly, secure, fully air-conditioned environment with attentive hospitality and private room options."
    },
    {
      icon: Zap,
      title: "Instant Live Booking",
      desc: "Select your game, lock your slot in seconds online, and skip any wait time when you arrive."
    },
    {
      icon: Clock,
      title: "24/7 Gaming Access",
      desc: "Day or night, late night gaming marathons or early morning snooker practice—we are open whenever you want to play."
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-bg border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="max-w-2xl mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="eyebrow text-brand-primary mb-3"
          >
            Why Gamers Choose Us
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
          >
            Built for Players Who Demand the Best
          </motion.h2>
        </div>

        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * idx }}
                className="flex flex-col border-t border-brand-border pt-6"
              >
                <div className="w-10 h-10 rounded-lg bg-brand-surface border border-brand-border flex items-center justify-center mb-6">
                  <Icon className="w-5 h-5 text-brand-primary" />
                </div>
                <h3 className="text-lg font-bold text-brand-text-main mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-brand-text-muted leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
