"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does online booking work?",
      a: "Simply head over to our booking page, pick the activity you'd like to play (e.g. Snooker, PS5, Cinema, Car Simulator), choose your preferred date and time slot, and submit. You'll receive instant booking confirmation."
    },
    {
      q: "Are the PS5 rooms and mini-cinema private?",
      a: "Yes! Our PS5 Private Suites and Mini Cinema are 100% private, acoustically isolated rooms designed for you and your group. Perfect for birthdays, private tournaments, and late-night binge gaming."
    },
    {
      q: "What are your operating hours?",
      a: "Zero One is open 24 hours a day, 7 days a week. You can book slots at any time that suits you, whether midday or late at night."
    },
    {
      q: "Can I bring snacks or drinks into the private rooms?",
      a: "We have an in-house snack bar and refreshment station with cold drinks, hot beverages, and light bites. Outside food is not permitted to keep equipment in pristine condition."
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-bg border-t border-brand-border">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="eyebrow text-brand-primary mb-3"
          >
            Got Questions?
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
          >
            Frequently Asked Questions
          </motion.h2>
        </div>

        {/* Accordion */}
        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * idx }}
                className="border border-brand-border bg-brand-surface overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full text-left px-6 py-5 flex justify-between items-center transition-colors hover:bg-brand-card-hover"
                >
                  <span className="font-semibold text-brand-text-main text-base sm:text-lg">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-brand-text-muted transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-brand-primary" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 pb-5 pt-1 text-brand-text-muted text-sm sm:text-base leading-relaxed border-t border-brand-border/40">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
