'use client';

import { ScrollReveal } from '@/components/motion/ScrollReveal';
import { TextReveal } from '@/components/motion/TextReveal';
import { HorizontalScroll } from '@/components/motion/ParallaxImage';
import { motion } from 'framer-motion';
import { Icon, type IconName } from '@/components/Icon';

const SOCIAL_ITEMS: Array<{
  platform: string;
  icon: string;
  platformColor: string;
  handle: string;
  href: string;
  title: string;
  description: string;
  iconName: IconName;
}> = [
  {
    platform: 'Instagram Reel',
    icon: 'IMG',
    platformColor: '#E1306C',
    handle: '@cueandplay.pk',
    href: 'https://www.instagram.com/cueandplay.pk',
    title: 'Pro Snooker Frame Clutches & Tournament Highlights',
    description: 'Watch the best breaks and table masterclasses.',
    iconName: 'snooker',
  },
  {
    platform: 'TikTok Viral',
    icon: 'VID',
    platformColor: '#00f2ea',
    handle: '@cueandplay.pk',
    href: 'https://www.tiktok.com/@cueandplay.pk',
    title: '120" Private Laser Cinema & Squad Room Tour',
    description: 'Atmos surround sound, Netflix, acoustics.',
    iconName: 'clapperboard',
  },
  {
    platform: 'Motion Simulator',
    icon: 'SIM',
    platformColor: '#00ff66',
    handle: '@cueandplay.pk',
    href: 'https://www.instagram.com/cueandplay.pk',
    title: 'Hot Lap Challenges & Time Attack Battles',
    description: 'Direct-drive force feedback with sim racers.',
    iconName: 'car',
  },
];

export function SocialShowcase() {
  return (
    <section className="relative overflow-hidden py-12">
      {/* Marquee background text */}
      <HorizontalScroll direction="left" className="mb-12 opacity-[0.03] pointer-events-none select-none mix-blend-screen">
        <span className="display-hero text-[8rem] sm:text-[12rem] text-brand-text-main whitespace-nowrap">
          TELEMETRY • BROADCAST • TELEMETRY • BROADCAST • TELEMETRY • BROADCAST •&nbsp;
        </span>
        <span className="display-hero text-[8rem] sm:text-[12rem] text-brand-text-main whitespace-nowrap">
          TELEMETRY • BROADCAST • TELEMETRY • BROADCAST • TELEMETRY • BROADCAST •&nbsp;
        </span>
      </HorizontalScroll>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <ScrollReveal animation="fadeUp">
            <span className="font-mono text-[10px] text-brand-primary uppercase tracking-widest flex items-center justify-center gap-2 mb-4">
              <span className="w-2 h-2 bg-brand-primary border border-brand-primary animate-ping" /> System Broadcast Array
            </span>
          </ScrollReveal>
          <TextReveal
            text="FOLLOW @CUEANDPLAY.PK"
            as="h2"
            className="display-xl text-4xl sm:text-5xl lg:text-6xl text-brand-text-main"
          />
          <ScrollReveal animation="blur" delay={0.3}>
            <p className="font-mono text-xs text-brand-text-muted max-w-xl mx-auto mt-4 border-t border-brand-border/40 pt-4">
              Tournament highlights, squad sessions, network tours, and weekly bandwidth giveaways.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SOCIAL_ITEMS.map((item, i) => (
            <ScrollReveal key={i} animation="fadeUp" delay={i * 0.1}>
              <motion.a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -5 }}
                className="block h-full bg-brand-surface border border-brand-border/40 hover:border-brand-text-main p-[1px] group transition-all duration-300 clip-angled relative overflow-hidden"
              >
                {/* Border Hover */ }
                <div className="absolute inset-0 bg-gradient-to-r from-brand-border via-brand-text-main to-brand-border opacity-0 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none" />

                <div className="bg-brand-bg h-full p-6 sm:p-7 flex flex-col justify-between clip-angled relative z-10 transition-colors group-hover:bg-brand-surface">

                  {/* Grid overlay */}
                  <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" />

                  <div className="space-y-5 relative z-10">
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest border-b border-brand-border/40 pb-3">
                      <span
                        className="font-bold flex items-center gap-1.5"
                        style={{ color: item.platformColor }}
                      >
                        <span className="w-1.5 h-1.5 block shrink-0" style={{ backgroundColor: item.platformColor }} />
                        {item.icon} // {item.platform}
                      </span>
                      <span className="text-brand-text-muted">{item.handle}</span>
                    </div>

                    <div
                      className="h-32 border border-brand-border/40 flex items-center justify-center text-brand-text-muted group-hover:text-brand-text-main group-hover:scale-[1.02] transition-all duration-500 clip-angled bg-brand-bg"
                      style={{
                        boxShadow: `inset 0 0 30px ${item.platformColor}10`
                      }}
                    >
                      <Icon name={item.iconName} size={42} />
                    </div>

                    <div>
                      <h3 className="font-display font-black text-sm uppercase tracking-wider text-brand-text-main group-hover:text-white transition-colors leading-snug">
                        {item.title}
                      </h3>
                      <p className="font-mono text-[10px] text-brand-text-muted leading-relaxed mt-2 uppercase tracking-wide opacity-80">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 font-mono text-[10px] uppercase tracking-widest border-t border-brand-border/40 pt-4 flex items-center justify-between relative z-10">
                    <span className="font-bold" style={{ color: item.platformColor }}>
                      Access_{item.platform.split(' ')[0]}()
                    </span>
                    <span
                      className="text-sm font-bold group-hover:translate-x-2 transition-transform"
                      style={{ color: item.platformColor }}
                    >
                      »
                    </span>
                  </div>
                </div>
              </motion.a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
