import type { PublicVisitStats } from '@/lib/api';
import { formatCount } from '@/lib/formatCount';
import { experiences } from './content';

export function StatsSection({ visitStats }: { visitStats: PublicVisitStats | null }) {
  const items = [
    [String(experiences.length).padStart(2, '0'), 'Ways to play', 'Gaming, cinema and more'],
    ['24/7', 'Always game time', 'Open around the clock'],
    [
      visitStats ? formatCount(visitStats.totalPlayerVisits) : '—',
      'Player visits',
      visitStats
        ? 'Completed sessions · every visit counts'
        : 'Visit count temporarily unavailable',
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
