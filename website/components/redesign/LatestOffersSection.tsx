import Image from 'next/image';
import Link from 'next/link';
import type { Offer } from '@/lib/api';
import { imageRoot, offerHref } from './content';
import { Arrow, PillLink, SectionHeading } from './ui';

export function LatestOffersSection({ offers }: { offers: Offer[] }) {
  const live = offers
    .filter((item) => item.isActive && item.isVisibleOnWebsite !== false)
    .slice(0, 2);
  const cards = live.length
    ? live.map((offer, index) => ({
        title: offer.title,
        label: 'Current offer',
        description: offer.description || 'See this offer when you book your next session.',
        href: offerHref(offer),
        image: index === 0 ? 'ps5-gaming.webp' : 'snooker.webp',
      }))
    : [
        {
          title: 'Make it a friendly snooker rivalry.',
          label: 'Experience guide',
          description: 'Get your friends together for a little focus and a lot of fun.',
          href: '/activities',
          image: 'snooker.webp',
        },
        {
          title: 'A movie night with your name on it.',
          label: 'Experience guide',
          description: 'Pick the film, bring your people and make the room your own.',
          href: '/activities',
          image: 'private-cinema.webp',
        },
      ];
  return (
    <section className="zo-section zo-latest" aria-label="Latest offers and experiences">
      <div className="zo-container">
        <SectionHeading
          label={live.length ? 'The latest offers' : 'Discover ZeroOne'}
          title="Something good to look forward to."
          description={
            live.length
              ? 'Current deals from ZeroOne, ready to explore in your booking.'
              : 'No active offers right now. Explore a few ideas for your next visit.'
          }
          centered
        />
        <div className="zo-news-grid">
          {cards.map((card) => (
            <Link
              prefetch={false}
              href={card.href}
              key={card.title}
              className="zo-news-card"
              data-reveal
            >
              <div className="zo-news-photo">
                <Image
                  src={`${imageRoot}/${card.image}`}
                  alt="Gaming experience illustration placeholder"
                  fill
                  sizes="(max-width: 700px) 92vw, 40vw"
                />
              </div>
              <div className="zo-news-copy">
                <span className="zo-eyebrow">{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span className="zo-circle-arrow">
                  <Arrow />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <div className="zo-section-action">
          <PillLink href={live[0] ? offerHref(live[0]) : '/activities'}>
            {live.length ? 'Explore Current Offers' : 'Explore the Experiences'}
          </PillLink>
        </div>
      </div>
    </section>
  );
}
