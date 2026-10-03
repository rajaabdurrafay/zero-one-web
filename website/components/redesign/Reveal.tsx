'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Content is visible without JavaScript. Only off-screen items receive the reveal state.
export function Reveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root.current || preference.matches || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.current.querySelectorAll<HTMLElement>('[data-reveal]'));
    const animations: Animation[] = [];
    // A short opening sequence, then stagger only siblings in each section.
    const opening = root.current.querySelectorAll<HTMLElement>(
      '.zo-hero-copy > *, .zo-hero-chips > div',
    );
    opening.forEach((element, index) => {
      animations.push(
        element.animate(
          [
            { opacity: 0, transform: 'translateY(24px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 700,
            delay: 90 + index * 85,
            easing: 'cubic-bezier(.22,1,.36,1)',
            fill: 'backwards',
          },
        ),
      );
    });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.remove('zo-reveal-pending');
            observer.unobserve(entry.target);
          }
      },
      { rootMargin: '0px 0px -24px 0px', threshold: 0.08 },
    );
    for (const element of elements) {
      const siblings = Array.from(element.parentElement?.children || []).filter((sibling) =>
        sibling.hasAttribute('data-reveal'),
      );
      element.style.setProperty(
        '--zo-reveal-delay',
        `${Math.max(0, siblings.indexOf(element) % 4) * 85}ms`,
      );
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('zo-reveal-pending');
        observer.observe(element);
      }
    }
    // Small image drift follows real scroll position; no React state or scroll hijacking.
    const photos = Array.from(
      root.current.querySelectorAll<HTMLElement>('.zo-hero, .zo-banner-card'),
    );
    let frame = 0;
    const updatePhotos = () => {
      frame = 0;
      for (const photo of photos) {
        const bounds = photo.getBoundingClientRect();
        if (bounds.bottom > 0 && bounds.top < innerHeight) {
          const offset = Math.max(-24, Math.min(24, -bounds.top * 0.045));
          photo.style.setProperty('--zo-photo-drift', `${offset.toFixed(1)}px`);
        }
      }
    };
    const onScroll = () => {
      if (!frame && !preference.matches) frame = requestAnimationFrame(updatePhotos);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updatePhotos();
    const showAll = () => {
      if (preference.matches) {
        animations.forEach((animation) => animation.cancel());
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        photos.forEach((photo) => photo.style.removeProperty('--zo-photo-drift'));
        elements.forEach((element) => element.classList.remove('zo-reveal-pending'));
        observer.disconnect();
      }
    };
    preference.addEventListener('change', showAll);
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      preference.removeEventListener('change', showAll);
      elements.forEach((element) => element.classList.remove('zo-reveal-pending'));
    };
  }, []);
  return <div ref={root}>{children}</div>;
}
