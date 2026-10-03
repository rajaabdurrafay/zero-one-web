import Link from 'next/link';
import type { ReactNode } from 'react';

export function Arrow({ className = '' }: { className?: string }) {
  return <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function PillLink({ href, children, secondary = false }: { href: string; children: ReactNode; secondary?: boolean }) {
  return <Link prefetch={false} className={`zo-pill${secondary ? ' zo-pill-secondary' : ''}`} href={href}><span>{children}</span><span className="zo-pill-arrow"><Arrow /></span></Link>;
}

export function SectionHeading({ label, title, description, centered = false }: { label: string; title: string; description?: string; centered?: boolean }) {
  return <div className={`zo-section-heading${centered ? ' zo-centered' : ''}`} data-reveal><span className="zo-eyebrow">{label}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}
