import { PageIntro } from '@/components/redesign/PageIntro';
import Link from 'next/link';
import Image from 'next/image';
import { getPricing, getActiveOffers, type Activity, type Offer } from '@/lib/api';
import { Icon, type IconName } from '@/components/Icon';

export const dynamic = 'force-dynamic';

const ACTIVITY_IMAGES: Record<string, string> = {
  SNOOKER: '/images/Snokker/snooker-table.jpg.webp',
  PS5_OPEN: '/images/PS5/ps5-room.jpg.webp',
  PS5_PRIVATE: '/images/priveat ps5.webp',
  CINEMA: '/images/Cinema/cinema.jpg.webp',
  TABLE_TENNIS: '/images/Table tennis/table-tennis.jpg.webp',
  CAR_SIMULATOR: '/images/Car simulater/car-simulator.jpg.webp',
};

const ACTIVITY_METADATA: Record<
  string,
  {
    iconName: IconName;
    description: string;
    tag: string;
    specs: string[];
  }
> = {
  SNOOKER: {
    iconName: 'snooker',
    description:
      '3 professional slate tables equipped with tournament-standard Strachan cloth, precision overhead luminaire lighting, and imported match cues. Walk-in anytime.',
    tag: 'Pro Snooker Hall',
    specs: ['3 Match Tables', 'Tournament Cloth', 'Overhead Lights', 'Rs 10/min Walk-In'],
  },
  PS5_OPEN: {
    iconName: 'gamepad',
    description:
      'Spacious open gaming hall with multiple PS5 battle stations, low-latency 4K 120Hz displays, DualSense wireless controllers, and pre-loaded latest AAA multiplayer titles.',
    tag: 'Esports Gaming Hall',
    specs: ['Multiple PS5 Rigs', '4K 120Hz Displays', 'Latest Titles', 'Squad Battles'],
  },
  PS5_PRIVATE: {
    iconName: 'tv',
    description:
      'Private acoustic-isolated VIP lounge featuring luxury plush recliners, custom RGB vibe lighting, 85" 4K OLED, and personal gaming suite for you and your squad.',
    tag: 'VIP Private Suite',
    specs: ['Soundproof Suite', 'Ultra-Plush Recliners', '85" 4K OLED', 'Private Squad Hangout'],
  },
  CINEMA: {
    iconName: 'clapperboard',
    description:
      'Private 120" 4K laser theater suite featuring Dolby Atmos surround sound, Netflix 4K streaming included, reclining seating, and full cinema ambiance for movies & live matches.',
    tag: 'Private Cinema & Streaming',
    specs: ['120" 4K Laser Projection', 'Dolby Atmos Sound', 'Netflix Included', 'VIP Theater Recliners'],
  },
  TABLE_TENNIS: {
    iconName: 'tableTennis',
    description:
      'Private enclosed table tennis room featuring an ITTF-certified full-size heavy-duty table, shock-absorbing flooring, carbon pro rackets, and high-tempo match lighting.',
    tag: 'Private TT Arena',
    specs: ['Full-Size ITTF Table', 'Private Dedicated Room', 'Pro Carbon Paddles', 'Smooth Fast Bounces'],
  },
  CAR_SIMULATOR: {
    iconName: 'car',
    description:
      'Next-level racing immersion featuring direct-drive force feedback steering, load-cell hydraulic pedals, motion cockpit, and triple-screen wrap-around telemetry display.',
    tag: 'Motion Racing Simulator',
    specs: ['Direct Drive FFB', 'Hydraulic Load-Cell', 'Motion Cockpit', '30m / 1h Slabs'],
  },
};

async function fetchActivities(): Promise<Activity[]> {
  try {
    const data = await getPricing();
    return Array.isArray(data) ? data:[];
  } catch (e) {
    return [];
  }
}

export default async function ActivitiesPage() {
  const [activities, offers] = await Promise.all([
    fetchActivities(),
    getActiveOffers().catch(() => [] as Offer[])
  ]);

  return (
    <div className="space-y-16 sm:space-y-24 zo-page-spacing">
      {!activities.length && <p className="text-center text-brand-text-muted">Live pricing is temporarily unavailable. Please contact the venue.</p>}
      {/* Top Banner */}
      <PageIntro label="Activities" title="Find your game." description="Six ways to make it a great night. Explore the spaces, compare live rates and choose your next session." image="/images/PS5/ps5-room.jpg.webp" />

      {/* Detailed Activities List */}
      <section className="zo-page-container space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {activities.map((activity) => {
            const meta = ACTIVITY_METADATA[activity.resourceType] || {
              iconName: 'target' as IconName,
              description: 'Top-tier setup and entertainment rig.',
              tag: 'Arena Experience',
              specs: ['High Quality Equipment', 'Comfortable Ambience', 'Instant Allocation'],
            };

            const isPerMinute = activity.pricingUnit === 'PER_MINUTE';
            const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

            // Check if there is an active deal applicable to this activity
            const matchingOffer = offers.find(
              (o) =>
                !o.promoCode &&
                (o.applicableTo === 'ALL_ACTIVITIES' || o.activityId === activity.id)
            );

            const getDiscountedRate = (rate: number) => {
              if (!matchingOffer) return rate;
              if (matchingOffer.discountType === 'PERCENTAGE') {
                return Math.round(rate * (1 - matchingOffer.discountValue / 100));
              }
              return Math.max(0, rate - matchingOffer.discountValue);
            };

            return (
              <div
                key={activity.id}
                data-reveal className="zo-experience-detail rounded-3xl zo-panel p-7 sm:p-9 bg-brand-surface border border-brand-border hover:border-brand-primary/40 shadow-xs transition-all flex flex-col justify-between relative overflow-hidden"
              >
                {matchingOffer && (
                  <div className="absolute top-4 right-4 bg-brand-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-xs flex items-center gap-1 z-10">
                    <Icon name="tag" size={11} />
                    <span>{matchingOffer.discountType === 'PERCENTAGE' ? `${matchingOffer.discountValue}% OFF` : `Rs ${matchingOffer.discountValue} OFF`}</span>
                  </div>
                )}
                <div className="space-y-6">
                  {/* Card Header with Image */}
                  {ACTIVITY_IMAGES[activity.resourceType] && (
                    <div className="relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden -mt-2 mb-6">
                      <Image
                        src={ACTIVITY_IMAGES[activity.resourceType]}
                        alt={`${activity.name} at ZeroOne`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 50vw"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-2xl bg-brand-surface-raised border border-brand-border text-brand-text-main flex items-center justify-center">
                        <Icon name={meta.iconName} size={28} />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-brand-border bg-brand-surface-raised text-brand-text-muted inline-block mb-1">
                          {meta.tag}
                        </span>
                        <h2 className="text-2xl font-black text-brand-text-main">
                          {activity.name}
                        </h2>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-brand-text-muted leading-relaxed">
                    {meta.description}
                  </p>

                  {/* Feature Highlights / Specs */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    {meta.specs.map((spec, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-surface-subtle border border-brand-border text-xs font-semibold text-brand-text-muted"
                      >
                        <Icon name="check" size={13} className="text-brand-primary font-bold shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing & Booking CTA Footer */}
                <div className="mt-8 pt-6 border-t border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] text-brand-text-muted uppercase tracking-widest font-bold block mb-1">
                      Official Rate
                    </span>
                    {hasTiered ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-brand-text-main">₨{activity.halfHourPrice}</span>
                          <span className="text-xs text-brand-text-muted">/ 30 min</span>
                          <span className="text-brand-text-muted font-bold">•</span>
                          <span className="text-2xl font-black text-brand-primary">₨{activity.fullHourPrice}</span>
                          <span className="text-xs text-brand-text-muted">/ 1 hour</span>
                        </div>
                        <span className="text-[11px] text-brand-primary font-semibold block mt-0.5">
                          Save ₨{((activity.halfHourPrice ?? 0) * 2) - (activity.fullHourPrice ?? 0)} with 1 hour session
                        </span>
                      </div>
                    ) : isPerMinute ? (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          {matchingOffer && (
                            <span className="text-lg line-through text-brand-text-muted font-bold">
                              ₨{activity.basePrice}
                            </span>
                          )}
                          <span className="text-3xl font-black text-brand-primary">
                            ₨{getDiscountedRate(activity.basePrice)}
                          </span>
                          <span className="text-xs text-brand-text-muted font-semibold">/ minute</span>
                        </div>
                        <span className="text-[11px] text-brand-text-muted font-medium block mt-0.5">
                          (₨{getDiscountedRate(activity.basePrice) * 60}/hr • Min 30 mins)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          {matchingOffer && (
                            <span className="text-lg line-through text-brand-text-muted font-bold">
                              ₨{activity.basePrice}
                            </span>
                          )}
                          <span className="text-3xl font-black text-brand-text-main">
                            ₨{getDiscountedRate(activity.basePrice)}
                          </span>
                          <span className="text-xs text-brand-text-muted font-semibold">/ hour</span>
                        </div>
                        <span className="text-[11px] text-brand-text-muted font-medium block mt-0.5">
                          Standard hourly reservation
                        </span>
                      </div>
                    )}
                  </div>

                  <Link
                    href={`/book?activity=${activity.id}`}
                    className="zo-action inline-flex items-center justify-center px-6 py-3 rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-xs active:scale-95 transition-all text-center whitespace-nowrap"
                  >
                    <span>Book Station</span>
                    <span className="ml-1.5">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Booking Rules & Walk-in Note */}
      <section className="zo-page-container">
        <div className="rounded-3xl zo-panel bg-brand-surface border border-brand-border p-8 sm:p-10 space-y-6 shadow-xs">
          <div className="flex items-center gap-3">
            <Icon name="calendar" size={22} className="text-brand-primary" />
            <h3 className="text-xl font-bold text-brand-text-main">Booking &amp; Walk-in Guidelines</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-brand-text-muted">
            <div className="space-y-2">
              <h4 className="font-bold text-brand-text-main flex items-center gap-2">
                <span className="text-brand-primary">1.</span> Online Advance Hold
              </h4>
              <p className="text-xs text-brand-text-muted leading-relaxed">
                Booking online holds your exact station for 15 minutes while you submit your payment receipt for instant confirmation.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-brand-text-main flex items-center gap-2">
                <span className="text-brand-primary">2.</span> Walk-In Anytime (24/7)
              </h4>
              <p className="text-xs text-brand-text-muted leading-relaxed">
                You can always walk straight into our Kamran Chowrangi venue. Available tables and consoles are allotted immediately at the counter.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold text-brand-text-main flex items-center gap-2">
                <span className="text-brand-primary">3.</span> Transparent Billing
              </h4>
              <p className="text-xs text-brand-text-muted leading-relaxed">
                Zero surge pricing, exact duration calculations, and instant digital receipts for every booking.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
