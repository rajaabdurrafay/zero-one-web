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

const DEFAULT_ACTIVITIES: Activity[] = [
  { id: '1', name: 'Snooker Hall', resourceType: 'SNOOKER', pricingUnit: 'PER_MINUTE', basePrice: 10, halfHourPrice: null, fullHourPrice: null, createdAt: '' },
  { id: '2', name: 'PS5 Open Gaming', resourceType: 'PS5_OPEN', pricingUnit: 'PER_HOUR', basePrice: 600, halfHourPrice: null, fullHourPrice: null, createdAt: '' },
  { id: '3', name: 'PS5 Private Room', resourceType: 'PS5_PRIVATE', pricingUnit: 'PER_HOUR', basePrice: 900, halfHourPrice: null, fullHourPrice: null, createdAt: '' },
  { id: '4', name: 'Private Cinema', resourceType: 'CINEMA', pricingUnit: 'PER_HOUR', basePrice: 1300, halfHourPrice: null, fullHourPrice: null, createdAt: '' },
  { id: '5', name: 'Table Tennis (Private)', resourceType: 'TABLE_TENNIS', pricingUnit: 'PER_HOUR', basePrice: 800, halfHourPrice: null, fullHourPrice: null, createdAt: '' },
  { id: '6', name: 'Car Simulator', resourceType: 'CAR_SIMULATOR', pricingUnit: 'PER_HOUR', basePrice: 900, halfHourPrice: 500, fullHourPrice: 900, createdAt: '' },
];

async function fetchActivities(): Promise<Activity[]> {
  try {
    const data = await getPricing();
    return data && data.length > 0 ? data : DEFAULT_ACTIVITIES;
  } catch (e) {
    return DEFAULT_ACTIVITIES;
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
