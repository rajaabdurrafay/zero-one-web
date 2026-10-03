'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Activity } from '@/lib/api';
import { Icon, type IconName } from '@/components/Icon';

const ACTIVITY_IMAGES: Record<string, string> = {
  SNOOKER: '/images/Snokker/snooker-table.jpg.webp',
  PS5_OPEN: '/images/priveat ps5.webp',
  PS5_PRIVATE: '/images/PS5/ps5-room.jpg.webp',
  CINEMA: '/images/Cinema/cinema.jpg.webp',
  TABLE_TENNIS: '/images/Table tennis/table-tennis.jpg.webp',
  CAR_SIMULATOR: '/images/Car simulater/car-simulator.jpg.webp',
};

const ACTIVITY_DETAILS: Record<
  string,
  {
    iconName: IconName;
    description: string;
    badge: string;
    rating: string;
  }
> = {
  SNOOKER: {
    iconName: 'snooker',
    description: 'Tournament-standard Strachan cloth, precision overhead lighting, and imported cues.',
    badge: 'Walk-in & Reserved',
    rating: '4.9/5',
  },
  PS5_OPEN: {
    iconName: 'gamepad',
    description: '4K 120Hz displays, wireless DualSense controllers, and preloaded AAA titles.',
    badge: 'Esports Hall',
    rating: '4.9/5',
  },
  PS5_PRIVATE: {
    iconName: 'tv',
    description: 'VIP acoustic-isolated squad lounge, luxury recliners, and 85" 4K OLED screen.',
    badge: 'VIP Private Suite',
    rating: '5.0/5',
  },
  CINEMA: {
    iconName: 'clapperboard',
    description: '120" 4K laser projection with Dolby Atmos sound, theater recliners, and Netflix.',
    badge: 'Private Cinema',
    rating: '4.9/5',
  },
  TABLE_TENNIS: {
    iconName: 'tableTennis',
    description: 'ITTF-certified heavy-duty table, carbon paddles, and shock-absorbing sports flooring.',
    badge: 'Private TT Arena',
    rating: '4.8/5',
  },
  CAR_SIMULATOR: {
    iconName: 'car',
    description: 'Direct-drive force feedback, hydraulic pedals, and full motion racing cockpit.',
    badge: 'Motion Sim Rig',
    rating: '5.0/5',
  },
};

interface PopularActivitiesProps {
  activities: Activity[];
}

export function PopularActivities({ activities }: PopularActivitiesProps) {
  const displayActivities = activities.slice(0, 3);

  return (
    <section id="activities" className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted mb-1 block">
            Popular Arenas
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
            Choose Your Experience
          </h2>
        </div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1 text-xs font-bold text-brand-text-main hover:underline self-start sm:self-end"
        >
          <span>View All Arenas</span>
          <span>→</span>
        </Link>
      </div>

      {/* 3-Card Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayActivities.map((activity, idx) => {
          const details = ACTIVITY_DETAILS[activity.resourceType] || {
            iconName: 'target' as IconName,
            description: 'Premium gaming equipment and dedicated station.',
            badge: 'Arena',
            rating: '4.9/5',
          };

          const isPerMinute = activity.pricingUnit === 'PER_MINUTE';
          const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 * idx }}
              key={activity.id}
              className="p-6 sm:p-8 rounded-3xl bg-brand-surface border border-brand-border flex flex-col justify-between hover:shadow-md transition-all overflow-hidden"
            >
              <div>
                {ACTIVITY_IMAGES[activity.resourceType] && (
                  <div className="relative h-40 sm:h-48 rounded-2xl overflow-hidden mb-5">
                    <Image
                      src={ACTIVITY_IMAGES[activity.resourceType]}
                      alt={`${activity.name} at ZeroOne`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="w-11 h-11 rounded-2xl bg-brand-surface-raised border border-brand-border flex items-center justify-center text-brand-text-main">
                    <Icon name={details.iconName} size={22} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-brand-surface-raised text-brand-text-muted border border-brand-border">
                      {details.badge}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-brand-text-main mt-4">
                  {activity.name}
                </h3>
                <p className="text-xs sm:text-sm text-brand-text-muted mt-2 leading-relaxed font-normal">
                  {details.description}
                </p>
              </div>

              <div className="mt-8 pt-5 border-t border-brand-border flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-brand-text-muted block">Rate</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-lg font-black text-brand-text-main">
                      ₨{hasTiered ? activity.fullHourPrice : activity.basePrice}
                    </span>
                    <span className="text-xs text-brand-text-muted">
                      / {isPerMinute && !hasTiered ? 'min' : 'hr'}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/book?activity=${activity.id}`}
                  className="px-5 py-2 rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors shadow-xs active:scale-[0.98]"
                >
                  Book Slot
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
