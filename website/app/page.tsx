import {
  getPricing,
  getActiveOffers,
  getPublicReviews,
  getPublicVisitStats,
  type Activity,
  type Offer,
} from '@/lib/api';
import { HeroSection } from '@/components/redesign/HeroSection';
import { Reveal } from '@/components/redesign/Reveal';
import { FeatureCardsSection } from '@/components/redesign/FeatureCardsSection';
import { ActivitiesSection } from '@/components/redesign/ActivitiesSection';
import { WhyZeroOneSection } from '@/components/redesign/WhyZeroOneSection';
import { StatsSection } from '@/components/redesign/StatsSection';
import { BookingBanner } from '@/components/redesign/BookingBanner';
import { PricingSection } from '@/components/redesign/PricingSection';
import { ConnectSection } from '@/components/redesign/ConnectSection';
import { ReviewsDealsSection } from '@/components/redesign/ReviewsDealsSection';
import { LatestOffersSection } from '@/components/redesign/LatestOffersSection';

export const dynamic = 'force-dynamic';

async function fetchActivities(): Promise<Activity[]> {
  try {
    const data = await getPricing();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

export default async function HomePage() {
  const [activities, offers, reviews, visitStats] = await Promise.all([
    fetchActivities(),
    getActiveOffers().catch(() => [] as Offer[]),
    getPublicReviews({ limit: 12 }),
    getPublicVisitStats(),
  ]);

  return (
    <div className="zo-home">
      <Reveal>
        <HeroSection stats={reviews.stats} />
        <FeatureCardsSection />
        <ActivitiesSection activities={activities} />
        <WhyZeroOneSection />
        <StatsSection visitStats={visitStats} />
        <BookingBanner />
        <PricingSection activities={activities} />
        <ReviewsDealsSection reviews={reviews.reviews} offers={offers} />
        <LatestOffersSection offers={offers} />
        <ConnectSection activities={activities} />
      </Reveal>
    </div>
  );
}
