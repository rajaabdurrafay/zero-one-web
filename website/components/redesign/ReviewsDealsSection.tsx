import type { Offer, Review } from '@/lib/api';
import { FeatureCard } from './FeatureCard';
import { venueImages, offerHref } from './content';
import { ReviewCarousel } from './ReviewCarousel';

export function ReviewsDealsSection({ reviews, offers }: { reviews: Review[]; offers: Offer[] }) {
  const offer = offers.find((item) => item.isActive && item.isVisibleOnWebsite !== false);
  return (
    <section
      className="zo-container zo-review-deal-grid"
      aria-label="Player feedback and current offers"
    >
      <ReviewCarousel reviews={reviews} />
      <FeatureCard
        variant="accent"
        tag="Make your next move"
        title="Your next great session is waiting."
        href={offerHref(offer)}
        image={venueImages.deal}
        alt="Console gaming setup at ZeroOne"
      />
    </section>
  );
}
