import Image from 'next/image';
import { imageRoot } from './content';
import { PillLink } from './ui';

export function BookingBanner() {
  return (
    <section className="zo-container" aria-labelledby="zo-booking-banner-title">
      <div className="zo-banner-card" data-reveal>
        <Image
          src={`${imageRoot}/hero-venue.webp`}
          alt="Gaming lounge illustration placeholder for the session booking banner"
          fill
          sizes="(max-width: 1280px) 100vw, 1240px"
        />
        <div className="zo-banner-overlay" />
        <span className="zo-eyebrow">Make time for a good time</span>
        <div className="zo-banner-bottom">
          <div>
            <h2 id="zo-booking-banner-title">Book Your Session.</h2>
            <p>Your people. Your game. Your next great night.</p>
          </div>
          <PillLink href="/book">Set Appointment</PillLink>
        </div>
      </div>
    </section>
  );
}
