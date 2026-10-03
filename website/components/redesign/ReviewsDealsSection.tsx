import Image from 'next/image';
import Link from 'next/link';
import type { Offer, Review } from '@/lib/api';
import { FeatureCard } from './FeatureCard';
import { venueImages, offerHref } from './content';

export function ReviewsDealsSection({ reviews, offers }: { reviews: Review[]; offers: Offer[] }) {
  const review =
    reviews.find((item) => item.isApproved && item.isFeatured) ||
    reviews.find((item) => item.isApproved);
  const offer = offers.find((item) => item.isActive && item.isVisibleOnWebsite !== false);
  return (
    <section
      className="zo-container zo-review-deal-grid"
      aria-label="Player feedback and current offers"
    >
      <article className="zo-testimonial" data-reveal>
        <Image
          src={venueImages.cinema}
          alt="ZeroOne private cinema seating"
          fill
          sizes="(max-width: 700px) 92vw, 45vw"
        />
        <div className="zo-testimonial-copy">
          <span className="zo-eyebrow">From our players</span>
          {review ? (
            <>
              <blockquote>&ldquo;{review.reviewText}&rdquo;</blockquote>
              <div className="zo-review-author">
                <strong>{review.customerName}</strong>
                <span>{review.rating} / 5 · Approved review</span>
              </div>
            </>
          ) : (
            <>
              <h3>
                Good times,
                <br />
                shared.
              </h3>
              <p>Player stories will appear here as approved reviews come in.</p>
            </>
          )}
          <Link prefetch={false} href="/reviews" className="zo-text-link">
            Read Player Reviews <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </article>
      <FeatureCard
        variant="accent"
        tag={offer ? 'Current deal' : 'Make your next move'}
        title={offer?.title || 'Your next great session is waiting.'}
        href={offerHref(offer)}
        image={venueImages.deal}
        alt="Console gaming setup at ZeroOne"
      />
    </section>
  );
}
