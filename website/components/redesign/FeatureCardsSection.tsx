import { FeatureCard } from './FeatureCard';
import { venueImages } from './content';

export function FeatureCardsSection() {
  return (
    <section className="zo-section zo-container" aria-label="Featured ZeroOne experiences">
      <h2 className="sr-only">Featured ZeroOne experiences</h2>
      <div className="zo-feature-grid">
        <FeatureCard
          tag="More than a game"
          title="Good games. Better company."
          image={venueImages.snooker}
          alt="Snooker tables inside ZeroOne"
          href="/activities"
        />
        <FeatureCard
          tag="Your next session"
          title="A little play goes a long way."
          image={venueImages.deal}
          alt="Console gaming room at ZeroOne"
          href="/activities"
          variant="accent"
        />
        <FeatureCard
          tag="Make it your own"
          title="Your squad. Your private space."
          image={venueImages.cinema}
          alt="Private cinema room at ZeroOne"
          href="/activities"
        />
      </div>
    </section>
  );
}
