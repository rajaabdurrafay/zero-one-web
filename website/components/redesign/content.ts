import type { Activity, Offer } from '@/lib/api';

export const imageRoot = '/images';
export const venueImages = {
  hero: '/images/hero-banner.jpg.webp',
  deal: '/images/PS5/ps5-room.jpg.webp',
  snooker: '/images/Snokker/snooker-table.jpg.webp',
  cinema: '/images/Cinema/cinema.jpg.webp',
};
export const experiences = [
  {
    type: 'SNOOKER',
    name: 'Snooker',
    image: 'Snokker/snooker-table.jpg.webp',
    description: 'A little focus. A friendly rivalry.',
    suggested: 'Rs. 10 / min',
  },
  {
    type: 'PS5_OPEN',
    name: 'PS5 Gaming',
    image: 'PS5/ps5-room.jpg.webp',
    description: 'Your next great squad session.',
    suggested: 'Rs. 600 / hr',
  },
  {
    type: 'CINEMA',
    name: 'Private Cinema',
    image: 'Cinema/cinema.jpg.webp',
    description: 'Big-screen nights, just for you.',
    suggested: 'Rs. 1,300 / hr',
  },
  {
    type: 'PS5_PRIVATE',
    name: 'Private PS5 Room',
    image: 'priveat ps5.webp',
    description: 'Your own room. Your own game.',
    suggested: 'Rs. 900 / hr',
  },
  {
    type: 'TABLE_TENNIS',
    name: 'Table Tennis Room',
    image: 'Table tennis/tablle tennis.webp',
    description: 'One more rally. One more round.',
    suggested: 'Rs. 800 / hr',
  },
  {
    type: 'CAR_SIMULATOR',
    name: 'Car Simulator',
    image: 'Car simulater/car-simulator.jpg.webp',
    description: 'Take the wheel. Chase your best lap.',
    suggested: 'Rs. 500 / 30 min · Rs. 900 / hr',
  },
] as const;

export function offerHref(offer?: Offer) {
  if (!offer) return '/book';
  const params = new URLSearchParams({ offerId: offer.id });
  if (offer.promoCode) params.set('promo', offer.promoCode);
  return `/book?${params.toString()}`;
}

export function bookingHref(activity?: Activity) {
  // Preserve the existing booking page's `activity` query parameter.
  return activity ? `/book?${new URLSearchParams({ activity: activity.id })}` : '/book';
}

export function livePrice(activity: Activity) {
  const format = (value: number) =>
    `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(value)}`;
  if (activity.pricingUnit === 'PER_MINUTE') return `${format(activity.basePrice)} / min`;
  if (
    activity.resourceType === 'CAR_SIMULATOR' &&
    activity.halfHourPrice != null &&
    activity.fullHourPrice != null
  )
    return `${format(activity.halfHourPrice)} / 30 min · ${format(activity.fullHourPrice)} / hr`;
  return `${format(activity.fullHourPrice ?? activity.basePrice)} / hr`;
}
