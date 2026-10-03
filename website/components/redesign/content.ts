import type { Activity, Offer } from '@/lib/api';

export const imageRoot = '/images/redesign';
export const experiences = [
  { type: 'SNOOKER', name: 'Snooker', image: 'snooker.webp', description: 'A little focus. A friendly rivalry.', suggested: 'Rs. 10 / min' },
  { type: 'PS5_OPEN', name: 'PS5 Gaming', image: 'ps5-gaming.webp', description: 'Your next great squad session.', suggested: 'Rs. 600 / hr' },
  { type: 'CINEMA', name: 'Private Cinema', image: 'private-cinema.webp', description: 'Big-screen nights, just for you.', suggested: 'Rs. 1,300 / hr' },
  { type: 'PS5_PRIVATE', name: 'Private PS5 Room', image: 'private-ps5-room.webp', description: 'Your own room. Your own game.', suggested: 'Rs. 900 / hr' },
  { type: 'TABLE_TENNIS', name: 'Table Tennis Room', image: 'table-tennis.webp', description: 'One more rally. One more round.', suggested: 'Rs. 800 / hr' },
  { type: 'CAR_SIMULATOR', name: 'Car Simulator', image: 'car-simulator.webp', description: 'Take the wheel. Chase your best lap.', suggested: 'Rs. 500 / 30 min · Rs. 900 / hr' },
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
  const format = (value: number) => `Rs. ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 2 }).format(value)}`;
  if (activity.pricingUnit === 'PER_MINUTE') return `${format(activity.basePrice)} / min`;
  if (activity.resourceType === 'CAR_SIMULATOR' && activity.halfHourPrice != null && activity.fullHourPrice != null) return `${format(activity.halfHourPrice)} / 30 min · ${format(activity.fullHourPrice)} / hr`;
  return `${format(activity.fullHourPrice ?? activity.basePrice)} / hr`;
}
