'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

type MotionChoice = 'system' | 'on' | 'off';
const storageKey = 'zeroone-motion';
function readChoice(): MotionChoice {
  try {
    const value = localStorage.getItem(storageKey);
    return value === 'on' || value === 'off' ? value : 'system';
  } catch {
    return 'system';
  }
}
function subscribeChoice(listener: () => void) {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
function subscribeSystem(listener: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', listener);
  return () => media.removeEventListener('change', listener);
}

// Content is visible without JavaScript. Only off-screen items receive the reveal state.
export function Reveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const savedChoice = useSyncExternalStore(
    subscribeChoice,
    readChoice,
    () => 'system' as MotionChoice,
  );
  const systemReduced = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const [override, setOverride] = useState<MotionChoice | null>(null);
  const choice = override ?? savedChoice;
  const enabled = choice === 'on' || (choice === 'system' && !systemReduced);
  const toggle = () => {
    const next = enabled ? 'off' : 'on';
    setOverride(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      /* Session choice still works. */
    }
  };
  useEffect(() => {
    if (!root.current || !enabled || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.current.querySelectorAll<HTMLElement>('[data-reveal]'));
    const animations: Animation[] = [];
    // A short opening sequence, then stagger only siblings in each section.
    const opening = root.current.querySelectorAll<HTMLElement>(
      '.zo-hero-copy > *, .zo-hero-chips > div, .zo-page-intro-copy > *',
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
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.remove('zo-reveal-pending');
          } else if (
            entry.boundingClientRect.bottom < 0 ||
            entry.boundingClientRect.top >= innerHeight
          ) {
            entry.target.classList.add('zo-reveal-pending');
          }
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
      const bounds = element.getBoundingClientRect();
      if (bounds.top > window.innerHeight || bounds.bottom < 0) {
        element.classList.add('zo-reveal-pending');
      }
      observer.observe(element);
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
      if (!frame) frame = requestAnimationFrame(updatePhotos);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updatePhotos();
    return () => {
      observer.disconnect();
      animations.forEach((animation) => animation.cancel());
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      photos.forEach((photo) => photo.style.removeProperty('--zo-photo-drift'));
      elements.forEach((element) => element.classList.remove('zo-reveal-pending'));
    };
  }, [enabled]);
  return (
    <div ref={root} data-motion={enabled ? 'on' : 'off'}>
      {children}
      <button type="button" className="zo-motion-control" onClick={toggle} aria-pressed={enabled}>
        <span aria-hidden="true">{enabled ? 'Ⅱ' : '▶'}</span>
        {enabled ? 'Pause animations' : 'Enable animations'}
      </button>
    </div>
  );
}
