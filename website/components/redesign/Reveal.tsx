'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Content is visible without JavaScript. Only off-screen items receive the reveal state.
export function Reveal({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!root.current || preference.matches || !('IntersectionObserver' in window)) return;
    const elements = Array.from(root.current.querySelectorAll<HTMLElement>('[data-reveal]'));
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
    for (const element of elements)
      if (element.getBoundingClientRect().top > window.innerHeight) {
        element.classList.add('zo-reveal-pending');
        observer.observe(element);
      }
    const showAll = () => {
      if (preference.matches) {
        elements.forEach((element) => element.classList.remove('zo-reveal-pending'));
        observer.disconnect();
      }
    };
    preference.addEventListener('change', showAll);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', showAll);
      elements.forEach((element) => element.classList.remove('zo-reveal-pending'));
    };
  }, []);
  return <div ref={root}>{children}</div>;
}
