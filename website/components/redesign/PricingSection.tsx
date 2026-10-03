import Link from 'next/link';
import Image from 'next/image';
import type { Activity } from '@/lib/api';
import { experiences, bookingHref, livePrice, venueImages } from './content';
import { Arrow, PillLink, SectionHeading } from './ui';

export function PricingSection({ activities }: { activities: Activity[] }) {
  const missingRates = experiences.some(
    (experience) => !activities.some((item) => item.resourceType === experience.type),
  );
  return (
    <section
      className="zo-section zo-container zo-pricing"
      id="pricing"
      aria-label="Activity pricing"
    >
      <SectionHeading
        label="Play your way"
        title="Good times. Clear prices."
        description="Pick your experience and see what your next session looks like. Availability and the final total are confirmed in booking."
      />
      <div className="zo-pricing-grid">
        <div className="zo-price-art" data-reveal>
          <Image
            src={venueImages.snooker}
            alt="Full-size snooker tables at ZeroOne Cue & Play"
            fill
            sizes="(max-width: 800px) 92vw, 420px"
          />
          <div>
            <span className="zo-eyebrow">ZeroOne Cue &amp; Play</span>
            <p>
              Your table.
              <br />
              Your next great game.
            </p>
          </div>
        </div>
        <div className="zo-price-list" data-reveal>
          {experiences.map((experience) => {
            const activity = activities.find((item) => item.resourceType === experience.type);
            return (
              <Link
                prefetch={false}
                href={bookingHref(activity)}
                className="zo-price-row"
                key={experience.type}
              >
                <span>{experience.name}</span>
                <strong>{activity ? livePrice(activity) : experience.suggested}</strong>
                <span className="zo-circle-arrow">
                  <Arrow />
                </span>
              </Link>
            );
          })}
          {missingRates && (
            <p className="zo-price-note">
              Indicative rates where live pricing is unavailable. Final rates are confirmed in
              booking.
            </p>
          )}
          <PillLink href="/book">Find Your Session</PillLink>
        </div>
      </div>
    </section>
  );
}
