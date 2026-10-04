'use client';

import { useEffect, useRef } from 'react';
import { formatCount } from '@/lib/formatCount';

export function CountUp({ value, padding = 1, suffix = '' }: { value: number; padding?: number; suffix?: string }) {
  const number = useRef<HTMLSpanElement>(null);
  const played = useRef(false);
  const finalText = formatCount(value).padStart(padding, '0') + suffix;

  useEffect(() => {
    const element = number.current;
    if (!element || played.current || value <= 0 || !('IntersectionObserver' in window)) return;
    let frame = 0;
    const motionAllowed = () => {
      const motion = element.closest('[data-motion]')?.getAttribute('data-motion');
      return motion === 'on' || (motion !== 'off' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      played.current = true;
      observer.disconnect();
      if (!motionAllowed()) return;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 1500);
        if (!motionAllowed() || progress === 1) { element.textContent = finalText; return; }
        const current = Math.floor(value * (1 - Math.pow(1 - progress, 3)));
        element.textContent = formatCount(current).padStart(padding, '0') + suffix;
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value, padding, suffix, finalText]);

  return (
    <span className="zo-count-up">
      <span className="zo-count-reserve" aria-hidden="true">{finalText}</span>
      <span ref={number} className="zo-count-visible" aria-hidden="true">{finalText}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
