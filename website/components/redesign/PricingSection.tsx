import Link from 'next/link';
import type { Activity } from '@/lib/api';
import { experiences, bookingHref, livePrice } from './content';
import { Arrow, PillLink, SectionHeading } from './ui';

export function PricingSection({ activities }: { activities: Activity[] }) {
  const missingRates = experiences.some(experience => !activities.some(item => item.resourceType === experience.type));
  return <section className="zo-section zo-container zo-pricing" id="pricing" aria-label="Activity pricing">
    <SectionHeading label="Play your way" title="Good times. Clear prices." description="Pick your experience and see what your next session looks like. Availability and the final total are confirmed in booking." />
    <div className="zo-pricing-grid">
      <div className="zo-price-art" data-reveal><svg viewBox="0 0 440 440" fill="none" aria-hidden="true"><circle cx="220" cy="220" r="168" /><circle cx="220" cy="220" r="115" /><path d="M220 30v380M30 220h380M84 84l272 272M84 356 356 84" /><path className="zo-art-blob" d="M220 76c40-8 24 72 59 64 47-12 83-54 94-16 12 43-55 62-30 98 26 38 84 48 59 81-29 37-75-19-99 12-31 41-7 108-51 102-42-6-25-79-66-73-42 7-80 65-103 25-23-38 48-58 34-92-18-41-91-47-66-87 24-37 64 7 92-23 32-35 35-81 77-91Z" /></svg><div><span className="zo-eyebrow">ZeroOne Cue &amp; Play</span><p>Find your game.<br />Make it your night.</p></div></div>
      <div className="zo-price-list" data-reveal>
        {experiences.map(experience => {
          const activity = activities.find(item => item.resourceType === experience.type);
          return <Link prefetch={false} href={bookingHref(activity)} className="zo-price-row" key={experience.type}><span>{experience.name}</span><strong>{activity ? livePrice(activity) : experience.suggested}</strong><span className="zo-circle-arrow"><Arrow /></span></Link>;
        })}
        {missingRates && <p className="zo-price-note">Indicative rates where live pricing is unavailable. Final rates are confirmed in booking.</p>}
        <PillLink href="/book">Find Your Session</PillLink>
      </div>
    </div>
  </section>;
}
