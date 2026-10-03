import type { Offer } from '@/lib/api';
import { FeatureCard } from './FeatureCard';
import { imageRoot, offerHref } from './content';

export function FeatureCardsSection({ offers }: { offers: Offer[] }) {
  const offer = offers.find(item => item.isActive && item.isVisibleOnWebsite !== false);
  return <section className="zo-section zo-container" aria-label="Featured ZeroOne experiences">
    <div className="zo-feature-grid">
      <FeatureCard tag="More than a game" title="Good games. Better company." image={`${imageRoot}/snooker.webp`} alt="Snooker table illustration placeholder" href="/activities" />
      <FeatureCard tag={offer ? 'Current offer' : 'Your next session'} title={offer?.title || 'A little play goes a long way.'} image={`${imageRoot}/current-deal.webp`} alt="Gaming controller illustration placeholder for the featured deal" href={offerHref(offer)} variant="accent" />
      <FeatureCard tag="Make it your own" title="Your squad. Your private space." image={`${imageRoot}/private-cinema.webp`} alt="Private cinema illustration placeholder" href="/activities" />
    </div>
  </section>;
}
