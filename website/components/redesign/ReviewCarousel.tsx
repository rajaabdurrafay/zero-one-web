'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Review } from '@/lib/api';
import { venueImages } from './content';

export function ReviewCarousel({ reviews }: { reviews: Review[] }) {
  const approved = reviews.filter((review) => review.isApproved);
  const ordered = [...approved.filter((review) => review.isFeatured), ...approved.filter((review) => !review.isFeatured)];
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const card = useRef<HTMLElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const count = ordered.length;
  const current = count ? index % count : 0;

  useEffect(() => {
    if (!card.current) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (count < 2 || hovered || focused || !inView) return;
    const timer = window.setInterval(() => {
      const motion = card.current?.closest('[data-motion]')?.getAttribute('data-motion');
      if (document.hidden || motion === 'off' || (motion !== 'on' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      setIndex((value) => (value + 1) % count);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [count, hovered, focused, inView, index]);

  const move = (direction: number) => {
    setIndex((value) => (value + direction + count) % count);
  };

  return (
    <article
      ref={card}
      className="zo-testimonial"
      data-reveal
      role="region"
      aria-roledescription="carousel"
      aria-label="Player reviews"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(event) => setFocused(event.target.matches(':focus-visible'))}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
      onTouchEnd={(event) => {
        if (!touchStart.current || count < 2) return;
        const dx = event.changedTouches[0].clientX - touchStart.current.x;
        const dy = event.changedTouches[0].clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}
    >
      <Image src={venueImages.cinema} alt="ZeroOne private cinema seating" fill sizes="(max-width: 700px) 92vw, 45vw" />
      <div className="zo-testimonial-copy">
        <span className="zo-eyebrow">From our players</span>
        <div className="zo-review-stage" aria-live={hovered || focused ? 'polite' : 'off'} aria-atomic="true">
          {count ? (
            <div key={ordered[current].id} className="zo-review-slide" role="group" aria-roledescription="slide" aria-label={`${current + 1} of ${count}`}>
              <blockquote>&ldquo;{ordered[current].reviewText}&rdquo;</blockquote>
              <div className="zo-review-author">
                <strong>{ordered[current].customerName}</strong>
                <span>{ordered[current].rating} / 5 · Player review</span>
              </div>
            </div>
          ) : (
            <><h3>Good times,<br />shared.</h3><p>Player stories will appear here as approved reviews come in.</p></>
          )}
        </div>
        <div className="zo-review-footer">
          <Link prefetch={false} href="/reviews" className="zo-text-link">Read Player Reviews <span aria-hidden="true">↗</span></Link>
          {count > 1 && (
            <div className="zo-review-controls">
              <button type="button" onClick={() => move(-1)} aria-label="Previous review">←</button>
              <span className="zo-review-position">{current + 1} / {count}</span>
              <button type="button" onClick={() => move(1)} aria-label="Next review">→</button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
