import type { PublicVisitStats } from '@/lib/api';
import { experiences } from './content';
import { CountUp } from './CountUp';

export function StatsSection({ visitStats }: { visitStats: PublicVisitStats | null }) {
  const items = [
    [<CountUp key="activities" value={experiences.length} padding={2} />, 'Ways to play', 'Gaming, cinema and more'],
    [<CountUp key="hours" value={24} suffix="/7" />, 'Always game time', 'Open around the clock'],
    [
      visitStats ? <CountUp key="visits" value={visitStats.totalPlayerVisits} /> : '—',
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
        <div key={String(label)} data-reveal>
          <strong>{number}</strong>
          <span>{label}</span>
          <small>{note}</small>
        </div>
      ))}
    </section>
  );
}
