"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function ServicesList() {
  const services = [
    {
      title: "Snooker Hall",
      desc: "Championship-grade full-size tables, tournament lighting, and master-crafted cues.",
      href: "/booking?activity=SNOOKER"
    },
    {
      title: "PS5 Open Lounge",
      desc: "High-refresh screens, high-speed connection, and all latest multiplayer blockbusters.",
      href: "/booking?activity=PS5_OPEN"
    },
    {
      title: "PS5 Private Suite",
      desc: "Private acoustic rooms with ultra-wide 4K setups and plush reclining seats.",
      href: "/booking?activity=PS5_PRIVATE"
    },
    {
      title: "Private Cinema",
      desc: "Bespoke theatre experience for private watch parties, tournaments, and streams.",
      href: "/booking?activity=CINEMA"
    },
    {
      title: "Table Tennis",
      desc: "Regulation ping-pong tables in private air-conditioned chambers.",
      href: "/booking?activity=TABLE_TENNIS"
    },
    {
      title: "Car Simulator",
      desc: "Direct-drive force feedback, realistic pedals, and triple-screen immersive sim.",
      href: "/booking?activity=CAR_SIMULATOR"
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-surface border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div className="max-w-2xl">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="eyebrow text-brand-primary mb-3"
            >
              What We Offer
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
            >
              A Complete Gaming Experience Under One Roof
            </motion.h2>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 md:mt-0"
          >
            <Link
              href="/pricing"
              className="inline-flex items-center text-sm font-semibold text-brand-primary hover:underline"
            >
              View Full Pricing & Plans
              <ArrowUpRight className="ml-1 w-4 h-4" />
            </Link>
          </motion.div>
        </div>

        {/* Activities List/Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 * idx }}
              className="group border border-brand-border p-8 bg-brand-bg hover:border-brand-primary transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-brand-text-main group-hover:text-brand-primary transition-colors">
                    {item.title}
                  </h3>
                  <ArrowUpRight className="w-5 h-5 text-brand-text-muted group-hover:text-brand-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <p className="text-sm text-brand-text-muted leading-relaxed mb-6">
                  {item.desc}
                </p>
              </div>

              <Link
                href={item.href}
                className="text-xs uppercase tracking-wider font-semibold text-brand-primary border-b border-transparent group-hover:border-brand-primary w-fit pb-0.5 transition-all"
              >
                Book Session
              </Link>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
