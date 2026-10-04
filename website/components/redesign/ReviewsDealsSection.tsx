import type { Review } from '@/lib/api';
import { FeatureCard } from './FeatureCard';
import { venueImages } from './content';
import { ReviewCarousel } from './ReviewCarousel';

export function ReviewsDealsSection({ reviews }: { reviews: Review[] }) {
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
        href="/activities"
        image={venueImages.deal}
        alt="Console gaming setup at ZeroOne"
      />
    </section>
  );
}
