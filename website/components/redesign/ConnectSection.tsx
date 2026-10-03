import Image from 'next/image';
import Link from 'next/link';
import type { Activity } from '@/lib/api';
import { imageRoot } from './content';
import { Arrow } from './ui';

export function ConnectSection({ activities }: { activities: Activity[] }) {
  return (
    <section className="zo-section zo-container" id="connect" aria-labelledby="zo-connect-title">
      <div className="zo-connect-card" data-reveal>
        <div className="zo-connect-copy">
          <span className="zo-eyebrow">Good games start here</span>
          <h2 id="zo-connect-title">Let&apos;s Connect.</h2>
          <p>
            A quick plan for your next session. Choose an experience, then pick your date and
            available time in our booking flow.
          </p>
          <form action="/book" method="GET" className="zo-connect-form">
            <label htmlFor="zo-experience">Your preferred experience</label>
            <select id="zo-experience" name="activity" defaultValue="">
              <option value="">Choose in the booking page</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </select>
            <p>Your session isn&apos;t reserved until you complete booking.</p>
            <button type="submit" className="zo-pill">
              <span>Continue to Booking</span>
              <span className="zo-pill-arrow">
                <Arrow />
              </span>
            </button>
          </form>
          <div className="zo-connect-links">
            <Link prefetch={false} href="/contact">
              Have a question? Get in touch <span aria-hidden="true">↗</span>
            </Link>
            <Link prefetch={false} href="/my-bookings">
              Already booked? View your sessions <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="zo-connect-photo">
          <Image
            src={`${imageRoot}/private-ps5-room.webp`}
            alt="Illustrated private gaming room placeholder for the venue photo"
            fill
            sizes="(max-width: 700px) 92vw, 45vw"
          />
          <Link prefetch={false} href="/location" className="zo-location-chip">
            <span className="zo-circle-arrow">
              <Arrow />
            </span>
            <span>
              <strong>Find your way to ZeroOne</strong>
              <small>Gulistan-e-Jauhar, Karachi</small>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
