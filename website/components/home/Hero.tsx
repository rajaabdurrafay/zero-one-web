"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-brand-surface pt-24 pb-16 sm:pt-32 sm:pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col space-y-6 lg:pr-8"
          >
            <h1 className="display-hero text-5xl sm:text-6xl lg:text-7xl text-brand-text-main">
              Play Different,<br />
              Together.
            </h1>
            <p className="text-lg sm:text-xl text-brand-text-muted max-w-lg leading-relaxed">
              Step into the premium gaming experience in Karachi. Whether you're here to conquer the tables or dominate the screen, your next great game starts here.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <Link
                href="/booking"
                className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold text-white transition-all bg-brand-primary hover:bg-brand-primary-hover rounded-none"
              >
                Book Now
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center px-8 py-3.5 text-sm font-semibold transition-all border border-brand-border hover:bg-brand-card-hover text-brand-text-main rounded-none"
              >
                Contact Us
              </Link>
            </div>
          </motion.div>

          {/* Right Content - Images and Badges */}
          <div className="relative h-[500px] sm:h-[600px] w-full mt-10 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="absolute top-0 right-0 w-4/5 h-[80%] rounded-2xl overflow-hidden shadow-2xl border border-brand-border z-10"
            >
              <Image
                src="/images/Snokker/snooker-table.jpg.webp"
                alt="Premium Snooker Hall"
                fill
                className="object-cover"
                priority
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="absolute bottom-0 left-0 w-3/5 h-[60%] rounded-2xl overflow-hidden shadow-xl border-4 border-brand-surface z-20"
            >
              <Image
                src="/images/priveat ps5.webp"
                alt="Private PS5 Room"
                fill
                className="object-cover"
              />
            </motion.div>

            {/* Floating Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="absolute top-12 left-0 z-30 bg-brand-surface/90 backdrop-blur-sm border border-brand-border px-4 py-3 shadow-lg rounded-xl flex flex-col items-center"
            >
              <span className="text-2xl font-bold text-brand-primary">24/7</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-text-muted">Open</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="absolute bottom-1/4 right-[-1rem] z-30 bg-brand-surface/90 backdrop-blur-sm border border-brand-border px-4 py-3 shadow-lg rounded-xl flex flex-col items-center"
            >
              <span className="text-2xl font-bold text-brand-primary">6</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-text-muted">Activities</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-brand-primary text-white border border-brand-primary-hover px-4 py-2 shadow-lg rounded-full whitespace-nowrap"
            >
              <span className="text-xs font-semibold uppercase tracking-wider">Open Since 2024</span>
            </motion.div>

          </div>
        </div>
      </div>
    </section>
  );
}
