"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";

export function TeamSection() {
  const team = [
    {
      name: "Daniyal Khan",
      role: "Operations & Head of Venue",
      bio: "Overseeing daily lounge operations and making sure every gamer gets tournament-level hospitality."
    },
    {
      name: "Hamza Sheikh",
      role: "Sim & Esports Specialist",
      bio: "Dedicated simulator calibrator and console optimization expert for private tournament setups."
    },
    {
      name: "Bilal Ahmed",
      role: "Snooker Master & Lead Host",
      bio: "National-level cueist maintaining table cloth precision, straight cues, and community leagues."
    }
  ];

  return (
    <section className="py-16 sm:py-24 bg-brand-surface border-t border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="eyebrow text-brand-primary mb-3"
          >
            Behind the Scenes
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="display-lg text-3xl sm:text-4xl lg:text-5xl text-brand-text-main"
          >
            Meet the Team
          </motion.h2>
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {team.map((member, idx) => (
            <motion.div
              key={member.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 * idx }}
              className="border border-brand-border p-8 bg-brand-bg flex flex-col justify-between"
            >
              <div>
                <div className="w-16 h-16 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center mb-6 text-brand-text-muted">
                  <User className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-brand-text-main">
                  {member.name}
                </h3>
                <p className="text-xs uppercase tracking-wider font-semibold text-brand-primary mt-1 mb-4">
                  {member.role}
                </p>
                <p className="text-sm text-brand-text-muted leading-relaxed">
                  {member.bio}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
