import type { ReviewsResponse } from '@/lib/api';
import { experiences } from './content';

export function StatsSection({ stats }: { stats: ReviewsResponse['stats'] }) {
  const items = [
    [String(experiences.length).padStart(2, '0'), 'Ways to play', 'Gaming, cinema and more'],
    ['—', 'Sessions booked', 'Total to be confirmed'],
    [stats.totalReviews > 0 ? `${stats.averageRating.toFixed(1)} / 5` : '—', 'Rated by our players', stats.totalReviews > 0 ? `${stats.totalReviews} approved reviews` : 'Reviews coming soon'],
    ['Karachi', 'Your local gaming spot', 'Gulistan-e-Jauhar'],
  ];
  return <section className="zo-stats zo-container" aria-label="ZeroOne at a glance">{items.map(([number, label, note]) => <div key={label} data-reveal><strong>{number}</strong><span>{label}</span><small>{note}</small></div>)}</section>;
}
