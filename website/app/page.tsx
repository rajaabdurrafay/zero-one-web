import { getPricing, getActiveOffers, type Activity, type Offer } from '@/lib/api';
import { HeroSection } from '@/components/sections/HeroSection';
import { PopularActivities } from '@/components/sections/PopularActivities';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { PromotionalSection } from '@/components/sections/PromotionalSection';
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
  const [activities, offers] = await Promise.all([
    fetchActivities(),
    getActiveOffers().catch(() => [] as Offer[]),
  ]);

  return (
    <div className="space-y-0 pb-0">
      <HeroSection offers={offers} />
      <PopularActivities activities={activities} />
      <PromotionalSection offers={offers} />
      <SocialReelsSection />
      <HowItWorks />
      <ReviewsSection />
      <LocationSection />
      <CTASection />
    </div>
  );
}
