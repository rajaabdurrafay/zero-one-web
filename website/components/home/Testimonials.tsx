"use client";

import { motion } from "framer-motion";
import { Star } from "lucide-react";

export function Testimonials() {
  const reviews = [
    {
      name: "Saad Farooq",
      activity: "PS5 Private Suite",
      quote: "Zero One is hands down the best gaming setup in Karachi. The private room was clean, the displays were top tier, and the AC was ice cold. Truly 10/10 experience.",
      rating: 5
    },
    {
      name: "Ali Raza",
      activity: "Snooker Hall",
      quote: "The snooker tables are maintained like tournament tables. Precise cloths, straight cues, and courteous staff. Having online booking makes it totally hassle-free.",
      rating: 5
    },
    {
      name: "Zubair Siddiqui",
      activity: "Car Simulator",
      quote: "The racing simulator setup with force feedback is insane. Felt like driving on an actual track. Can't wait to come back for our next weekend session.",
      rating: 5
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-surface border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="eyebrow text-brand-primary mb-3"
            >
              Testimonials
            </motion.p>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
            >
              What Gamers Say
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="flex items-center space-x-2 mt-4 md:mt-0"
          >
            <div className="flex text-amber-500">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <span className="text-sm font-semibold text-brand-text-main">
              4.9/5.0 on Google Reviews
            </span>
          </motion.div>
        </div>

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((rev, idx) => (
            <motion.div
              key={rev.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="border border-brand-border p-8 bg-brand-bg flex flex-col justify-between"
            >
              <div>
                <div className="flex text-amber-500 mb-4">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-brand-text-main text-sm sm:text-base leading-relaxed italic mb-6">
                  "{rev.quote}"
                </p>
              </div>

              <div>
                <p className="font-bold text-brand-text-main text-sm">
                  {rev.name}
                </p>
                <p className="text-xs text-brand-text-muted mt-0.5">
                  {rev.activity}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
