import Image from 'next/image';
import type { ReviewsResponse } from '@/lib/api';
import { PillLink } from './ui';
import { venueImages } from './content';

export function HeroSection({ stats }: { stats: ReviewsResponse['stats'] }) {
  return (
    <section className="zo-hero zo-container" aria-labelledby="zo-hero-title">
      <Image
        src={venueImages.hero}
        alt="ZeroOne Cue & Play entrance and snooker lounge in Karachi"
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
      />
      <div className="zo-hero-overlay" />
      <div className="zo-hero-copy">
        <span className="zo-eyebrow">ZeroOne Cue &amp; Play · Karachi</span>
        <h1 id="zo-hero-title">
          Your Ultimate
          <br />
          Gaming Zone.
        </h1>
        <p>
          Make room for a great time. Games, movie nights and friendly competition, all under one
          roof.
        </p>
        <PillLink href="/book">Book Now</PillLink>
      </div>
      <div className="zo-hero-chips">
        <div>
          <span>Find us</span>
          <strong>Gulistan-e-Jauhar, Karachi</strong>
        </div>
        <div>
          <span>Opening hours</span>
          <strong>Contact venue for timing</strong>
        </div>
        <div>
          <span>Player reviews</span>
          <strong>
            {stats.totalReviews > 0
              ? `${stats.averageRating.toFixed(1)} / 5 · ${stats.totalReviews} reviews`
              : 'Reviews coming soon'}
          </strong>
        </div>
      </div>
    </section>
  );
}
