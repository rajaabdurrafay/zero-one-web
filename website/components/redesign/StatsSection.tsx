import type { Activity, ReviewsResponse } from '@/lib/api';
import { experiences, livePrice } from './content';

export function StatsSection({
  stats,
  activities,
}: {
  stats: ReviewsResponse['stats'];
  activities: Activity[];
}) {
  const snooker = activities.find((item) => item.resourceType === 'SNOOKER');
  const items = [
    [String(experiences.length).padStart(2, '0'), 'Ways to play', 'Gaming, cinema and more'],
    [
      snooker ? livePrice(snooker) : 'Rs. 10 / min',
      'Snooker pricing',
      snooker ? 'Live venue rate' : 'Indicative rate; confirm in booking',
    ],
    [
      stats.totalReviews > 0 ? `${stats.averageRating.toFixed(1)} / 5` : '0',
      stats.totalReviews > 0 ? 'Rated by our players' : 'Approved player reviews',
      stats.totalReviews > 0 ? `${stats.totalReviews} approved reviews` : 'Reviews coming soon',
    ],
    ['Karachi', 'Your local gaming spot', 'Gulistan-e-Jauhar'],
  ];
  return (
    <section className="zo-stats zo-container" aria-label="ZeroOne at a glance">
      {items.map(([number, label, note]) => (
        <div key={label} data-reveal>
          <strong>{number}</strong>
          <span>{label}</span>
          <small>{note}</small>
        </div>
      ))}
    </section>
  );
}
