import { getPricing, getActiveOffers, getPublicReviews, type Activity, type Offer } from '@/lib/api';
import { HeroSection } from '@/components/redesign/HeroSection';
import { Reveal } from '@/components/redesign/Reveal';
import { FeatureCardsSection } from '@/components/redesign/FeatureCardsSection';
import { ActivitiesSection } from '@/components/redesign/ActivitiesSection';
import { WhyZeroOneSection } from '@/components/redesign/WhyZeroOneSection';
import { StatsSection } from '@/components/redesign/StatsSection';
import { BookingBanner } from '@/components/redesign/BookingBanner';
import { LocationSection } from '@/components/sections/LocationSection';
import { ReviewsSection } from '@/components/sections/ReviewsSection';
import { SocialReelsSection } from '@/components/sections/SocialReelsSection';
import { CTASection } from '@/components/sections/CTASection';

export const dynamic = 'force-dynamic';

async function fetchActivities(): Promise<Activity[]> {
  try {
    const data = await getPricing();
    return Array.isArray(data) ? data:[];
  } catch (e) {
    return [];
  }
}

export default async function HomePage() {
  const [activities, offers, reviews] = await Promise.all([
    fetchActivities(),
    getActiveOffers().catch(() => [] as Offer[]),
    getPublicReviews({ limit: 3 }),
  ]);

  return (
    <div className="zo-home"><Reveal>
      <HeroSection stats={reviews.stats} />
      <FeatureCardsSection offers={offers} />
      <ActivitiesSection activities={activities} />
      <WhyZeroOneSection />
      <StatsSection stats={reviews.stats} />
      <BookingBanner />
      <SocialReelsSection />
      <ReviewsSection />
      <LocationSection />
      <CTASection />
    </Reveal></div>
  );
}
