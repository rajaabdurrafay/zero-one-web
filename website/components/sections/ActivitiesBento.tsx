'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ScrollReveal, StaggerContainer, StaggerItem } from '@/components/motion/ScrollReveal';
import { TextReveal } from '@/components/motion/TextReveal';
import { MagneticButton } from '@/components/motion/MagneticButton';
import type { Activity } from '@/lib/api';
import { Icon, type IconName } from '@/components/Icon';

const ACTIVITY_META: Record<
  string,
  {
    iconName: IconName;
    description: string;
    tag: string;
    accentHex: string;
    bgClass: string;
  }
> = {
  SNOOKER: {
    iconName: 'snooker',
    description: 'Tournament-standard slate tables with professional Strachan cloth and precision lighting.',
    tag: 'Pro Snooker',
    accentHex: '#00ff66',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-brand-bg to-brand-bg',
  },
  PS5_OPEN: {
    iconName: 'gamepad',
    description: 'Esports hall with multiple PS5 stations, 4K 120Hz displays, and all latest titles.',
    tag: 'Open PS5 Hall',
    accentHex: '#00f0ff',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/20 via-brand-bg to-brand-bg',
  },
  PS5_PRIVATE: {
    iconName: 'tv',
    description: 'VIP sound-isolated squad room with luxury recliners and 85" 4K OLED display.',
    tag: 'VIP Private Suite',
    accentHex: '#b142ff',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/20 via-brand-bg to-brand-bg',
  },
  CINEMA: {
    iconName: 'clapperboard',
    description: 'Private 120" 4K laser cinema with Dolby Atmos surround sound and theater seating.',
    tag: 'Private Cinema',
    accentHex: '#ff3366',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/20 via-brand-bg to-brand-bg',
  },
  TABLE_TENNIS: {
    iconName: 'tableTennis',
    description: 'ITTF-certified table tennis with pro carbon paddles and shock-absorbing flooring.',
    tag: 'Private TT Arena',
    accentHex: '#ffaa00',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-900/20 via-brand-bg to-brand-bg',
  },
  CAR_SIMULATOR: {
    iconName: 'car',
    description: 'Direct-drive force feedback steering with load-cell pedals and motion racing cockpit.',
    tag: 'Motion Rig',
    accentHex: '#ff003c',
    bgClass: 'bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-red-900/20 via-brand-bg to-brand-bg',
  },
};

const DEFAULT_META: {
  iconName: IconName;
  description: string;
  tag: string;
  accentHex: string;
  bgClass: string;
} = {
  iconName: 'target',
  description: 'Top-tier gaming setup with high performance hardware.',
  tag: 'Activity',
  accentHex: '#ffffff',
  bgClass: 'bg-brand-bg',
};

interface ActivitiesBentoProps {
  activities: Activity[];
}

export function ActivitiesBento({ activities }: ActivitiesBentoProps) {
  return (
    <section id="activities" className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24 pb-20">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
        <div>
          <ScrollReveal animation="fadeRight">
            <span className="eyebrow text-brand-primary opacity-80 flex items-center gap-2 mb-3">
              <span className="w-1 h-3 bg-brand-primary block" /> Systems active
            </span>
          </ScrollReveal>
          <TextReveal
            text="CHOOSE YOUR ARENA"
            as="h2"
            className="display-xl text-4xl sm:text-5xl lg:text-6xl text-brand-text-main"
          />
          <ScrollReveal animation="blur" delay={0.3}>
            <p className="text-brand-text-muted font-mono text-sm max-w-xl mt-4 border-l border-brand-border/50 pl-3">
              Real-time slot bookings synchronized. Allocate your hardware.
            </p>
          </ScrollReveal>
        </div>
        <ScrollReveal animation="fadeLeft" delay={0.3}>
          <MagneticButton as="a" href="/activities" strength={0.4}>
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-brand-text-main bg-brand-border/40 hover:bg-brand-border py-2 px-4 clip-angled transition-colors group">
              <span>View All</span>
              <span className="group-hover:translate-x-1 transition-transform text-brand-primary">+</span>
            </span>
          </MagneticButton>
        </ScrollReveal>
      </div>

      {/* Cyber Grid Framework */}
      <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
        {activities.map((activity, index) => {
          const meta = ACTIVITY_META[activity.resourceType] || DEFAULT_META;
          const isLargeCard = index < 2;
          const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

          return (
            <StaggerItem
              key={activity.id}
              className={isLargeCard && index === 0 ? 'lg:col-span-2 lg:row-span-1' : ''}
            >
              <div
                className={`group relative h-full flex flex-col justify-between p-[1px] bg-brand-border/60 hover:bg-brand-text-main transition-colors duration-500 clip-angled overflow-hidden`}
                style={{ '--highlight': meta.accentHex } as React.CSSProperties}
              >
                {/* Inner Card */}
                <div className={`relative h-full flex flex-col justify-between bg-brand-bg ${meta.bgClass} p-8 clip-angled overflow-hidden`}>

                  {/* Corner accents */}
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: meta.accentHex }} />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ borderColor: meta.accentHex }} />

                  {/* Hover Scanline */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent h-[20%] -translate-y-full group-hover:animate-[scanline_2s_linear_infinite]" />

                  <div className="space-y-5 relative z-10">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-brand-text-main group-hover:text-white transition-colors duration-300">
                          <Icon name={meta.iconName} size={28} />
                        </span>
                        <div>
                          <span className="font-mono text-[10px] uppercase font-bold tracking-widest block opacity-60">
                            ID: {activity.resourceType}
                          </span>
                        </div>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-black border"
                        style={{ borderColor: meta.accentHex, color: meta.accentHex }}
                      >
                        {meta.tag}
                      </span>
                    </div>

                    <div>
                      <h3 className="display-lg text-2xl text-brand-text-main group-hover:text-white transition-colors">
                        {activity.name}
                      </h3>
                      <p className="text-sm font-sans text-brand-text-muted mt-3 line-clamp-2 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-5 border-t border-brand-border/50 flex flex-wrap items-end justify-between gap-4 relative z-10">
                    <div>
                      <div className="font-mono text-[10px] text-brand-text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-1 h-1 bg-brand-border block group-hover:bg-brand-primary" /> Cost Params
                      </div>
                      <div className="flex items-baseline gap-1.5 font-sans">
                        <span className="text-2xl font-black text-brand-text-main group-hover:text-white transition-colors">
                          ₨{hasTiered ? activity.fullHourPrice : activity.basePrice}
                        </span>
                        <span className="text-xs text-brand-text-muted uppercase tracking-widest">
                          / {hasTiered || activity.pricingUnit === 'PER_HOUR' ? 'HR' : 'MIN'}
                        </span>
                      </div>
                    </div>

                    <Link href={`/book?activity=${activity.id}`} className="shrink-0 overflow-hidden group/btn relative inline-flex">
                      <div className="absolute inset-0 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" style={{ background: meta.accentHex }} />
                      <span className="relative z-10 px-5 py-2.5 text-xs font-black uppercase tracking-widest border border-brand-border bg-brand-surface group-hover/btn:bg-transparent group-hover/btn:text-black transition-colors duration-300 flex items-center gap-2 clip-angled">
                        Allocate
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>

      {/* Custom keyframes injected via style tag for scanline */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scanline {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(500%); }
        }
      `}} />
    </section>
  );
}
