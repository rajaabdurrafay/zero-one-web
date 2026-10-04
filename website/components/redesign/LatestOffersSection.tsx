import Image from 'next/image';
import Link from 'next/link';
import type { Offer } from '@/lib/api';
import { imageRoot, offerHref } from './content';
import { Arrow, PillLink, SectionHeading } from './ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Resolve a backend image path to a full URL (prepend API_BASE for /uploads/ paths). */
function resolveImageUrl(url: string): string {
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads/')) return `${API_BASE}${url}`;
  return url;
}

export function LatestOffersSection({ offers }: { offers: Offer[] }) {
  const live = offers
    .filter((item) => item.isActive && item.isVisibleOnWebsite !== false)
    .slice(0, 2);
  const singleOffer = live.length === 1;
  const cards = live.length
    ? live.map((offer, index) => ({
        title: offer.title,
        label: 'Current offer',
        description: offer.description || 'See this offer when you book your next session.',
        href: offerHref(offer),
        image: offer.bannerImageUrl
          ? resolveImageUrl(offer.bannerImageUrl)
          : `${imageRoot}/${index === 0 ? 'PS5/ps5-room.jpg.webp' : 'Snokker/snooker-table.jpg.webp'}`,
      }))
    : [
        {
          title: 'Make it a friendly snooker rivalry.',
          label: 'Experience guide',
          description: 'Get your friends together for a little focus and a lot of fun.',
          href: '/activities',
          image: `${imageRoot}/Snokker/snooker-table.jpg.webp`,
        },
        {
          title: 'A movie night with your name on it.',
          label: 'Experience guide',
          description: 'Pick the film, bring your people and make the room your own.',
          href: '/activities',
          image: `${imageRoot}/Cinema/cinema.jpg.webp`,
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
        <div className={`zo-news-grid${singleOffer ? ' zo-news-grid-single' : ''}`}>
          {cards.map((card) => (
            <Link
              prefetch={false}
              href={card.href}
              key={card.title}
              className={`zo-news-card${singleOffer ? ' zo-news-card-featured' : ''}`}
              data-reveal
            >
              <div className="zo-news-photo">
                <Image
                  src={card.image}
                  alt={`${card.title} — ZeroOne venue photograph`}
                  fill
                  sizes={singleOffer ? '(max-width: 760px) 92vw, 46vw' : '(max-width: 600px) 92vw, (max-width: 900px) 44vw, 24vw'}
                  unoptimized={card.image.includes('/uploads/')}
                />
              </div>
              <div className="zo-news-copy">
                <span className="zo-eyebrow">{card.label}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                {singleOffer && <span className="zo-news-offer-link">Explore this offer</span>}
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
