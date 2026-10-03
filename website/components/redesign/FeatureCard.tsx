import Image from 'next/image';
import Link from 'next/link';
import { Arrow } from './ui';

export interface FeatureCardProps {
  tag: string;
  title: string;
  image: string;
  alt: string;
  href: string;
  variant?: 'surface' | 'accent';
}

export function FeatureCard({
  tag,
  title,
  image,
  alt,
  href,
  variant = 'surface',
}: FeatureCardProps) {
  return (
    <Link prefetch={false} href={href} className={`zo-feature zo-feature-${variant}`} data-reveal>
      <div className="zo-feature-copy">
        <span className="zo-eyebrow">{tag}</span>
        <h3>{title}</h3>
        <span className="zo-circle-arrow">
          <Arrow />
        </span>
      </div>
      <div className="zo-feature-photo">
        <Image
          src={image}
          alt={alt}
          fill
          sizes="(max-width: 700px) 92vw, (max-width: 1100px) 44vw, 30vw"
        />
      </div>
    </Link>
  );
}
