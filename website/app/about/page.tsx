import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/Icon';

export const metadata = {
  title: 'About Us â€” ZeroOne Cue & Play Karachi',
  description: 'Learn about ZeroOne Cue & Play â€” Karachiâ€™s premier 24/7 destination for Snooker, PS5, Private Cinema, and Esports.',
};

export default function AboutPage() {
  return (
    <div className="space-y-16 sm:space-y-24 pb-16 pt-24 sm:pt-28 font-sans">
      {/* Hero Banner */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-surface-raised border border-brand-border rounded-full text-xs font-semibold text-brand-text-muted">
          <Icon name="target" size={13} className="text-brand-primary" />
          <span>The ZeroOne Project</span>
        </div>
        <h1 className="text-4xl sm:text-7xl font-black text-brand-text-main tracking-tight leading-[0.95]">
          KARACHI&apos;S PREMIER DESTINATION TO <br />
          <span className="text-brand-primary">
            PLAY DIFFERENT.
          </span>
        </h1>
        <p className="text-brand-text-muted text-sm sm:text-base max-w-3xl mx-auto leading-relaxed">
          Founded in the heart of Gulistan-e-Jauhar, ZeroOne Cue &amp; Play was created with a single mission: to redefine Karachi&apos;s gaming, entertainment, and sports experience under one luxury roof.
        </p>
      </section>

      {/* Narrative Section: What Makes Us Different */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-block px-3 py-1 bg-brand-surface-raised border border-brand-border rounded-full text-xs font-bold text-brand-text-main">
              Our Vision
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-brand-text-main tracking-tight">
              A Complete Entertainment Lounge
            </h2>
            <p className="text-brand-text-muted text-sm sm:text-base leading-relaxed">
              We identified the gaps in standard gaming cafes: cramped spaces, poor ventilation, and outdated equipment. ZeroOne was engineered as an all-in-one luxury club where snooker purists, console gamers, movie enthusiasts, and competitive athletes play in comfort.
            </p>
            <p className="text-brand-text-muted text-sm sm:text-base leading-relaxed">
              Located conveniently on the Mezzanine Floor at Kamran Chowrangi, Gulistan-e-Jauhar. We feature chilled climate control, high-definition displays, tournament-grade equipment, and 100% backup power.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-5 bg-brand-surface border border-brand-border rounded-2xl">
                <div className="text-2xl sm:text-3xl font-black text-brand-text-main">24/7/365</div>
                <div className="text-xs text-brand-text-muted mt-1">Open Around the Clock</div>
              </div>
              <div className="p-5 bg-brand-surface border border-brand-border rounded-2xl">
                <div className="text-2xl sm:text-3xl font-black text-brand-text-main">100% VIP</div>
                <div className="text-xs text-brand-text-muted mt-1">Private Acoustic Suites</div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Feature Showcase Card */}
            <div className="bg-brand-surface border border-brand-border rounded-3xl p-8 sm:p-10 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-b border-brand-border pb-5">
                <Image
                  src="/logo-dark.png"
                  alt="ZEROONE Cue & Play"
                  width={200}
                  height={70}
                  className="h-10 w-auto object-contain block dark:hidden"
                />
                <Image
                  src="/logo.png"
                  alt="ZEROONE Cue & Play"
                  width={200}
                  height={70}
                  className="h-10 w-auto object-contain hidden dark:block"
                />
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-brand-text-main">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-raised border border-brand-border">
                  <span className="font-bold text-brand-primary w-14">01</span>
                  <span>3 Tournament-Grade Strachan Snooker Tables</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-raised border border-brand-border">
                  <span className="font-bold text-brand-primary w-14">02</span>
                  <span>PS5 Battle Stations &amp; Private VIP Lounge Suite</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-raised border border-brand-border">
                  <span className="font-bold text-brand-primary w-14">03</span>
                  <span>120&quot; 4K Private Cinema with Dolby Atmos 7.1 Surround</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-raised border border-brand-border">
                  <span className="font-bold text-brand-primary w-14">04</span>
                  <span>ITTF Regulation Table Tennis Arena</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface-raised border border-brand-border">
                  <span className="font-bold text-brand-primary w-14">05</span>
                  <span>Direct-Drive Motion Sim Racing Cockpit</span>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  href="/book"
                  className="w-full inline-flex items-center justify-center py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm text-white bg-brand-primary hover:bg-brand-primary-hover shadow-xs transition-colors"
                >
                  Book Your Experience â†’
                </Link>
              </div>
            </div>

            {/* Venue Image */}
            <div className="relative h-64 sm:h-80 rounded-3xl overflow-hidden border border-brand-border">
              <Image
                src="/images/waiting.webp"
                alt="ZeroOne Cue and Play Venue Interior"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10 pb-6">
        <div className="space-y-3">
          <div className="inline-block px-3 py-1 bg-brand-surface-raised border border-brand-border rounded-full text-xs font-bold text-brand-text-muted">
            Our Standards
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-brand-text-main tracking-tight">
            The ZeroOne Standard
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 bg-brand-surface border border-brand-border rounded-3xl space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-brand-surface-raised border border-brand-border text-brand-primary flex items-center justify-center rounded-2xl">
              <Icon name="sparkles" size={24} />
            </div>
            <h3 className="text-lg font-bold text-brand-text-main">Uncompromised Quality</h3>
            <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed">
              We never cut corners on equipment. From tournament cue sticks to calibrated racing wheels, everything is maintained daily to professional specifications.
            </p>
          </div>

          <div className="p-8 bg-brand-surface border border-brand-border rounded-3xl space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-brand-surface-raised border border-brand-border text-brand-primary flex items-center justify-center rounded-2xl">
              <Icon name="shield" size={24} />
            </div>
            <h3 className="text-lg font-bold text-brand-text-main">Safe &amp; Premium Atmosphere</h3>
            <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed">
              Strict 24/7 security, family-safe private cinema rooms, respectful staff, and a vibrant community atmosphere suitable for everyone.
            </p>
          </div>

          <div className="p-8 bg-brand-surface border border-brand-border rounded-3xl space-y-4 shadow-xs">
            <div className="w-12 h-12 bg-brand-surface-raised border border-brand-border text-brand-primary flex items-center justify-center rounded-2xl">
              <Icon name="clock" size={24} />
            </div>
            <h3 className="text-lg font-bold text-brand-text-main">Instant Online Reservations</h3>
            <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed">
              Seamless reservations with transparent pricing, instant slot confirmation, and digital booking passes on WhatsApp and SMS.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center mt-12 mb-12">
        <div className="bg-brand-surface border border-brand-border rounded-3xl p-10 sm:p-16 space-y-6 shadow-sm">
          <h2 className="text-3xl sm:text-5xl font-black text-brand-text-main leading-tight tracking-tight">
            Ready to Play Different?
          </h2>
          <p className="text-sm text-brand-text-muted max-w-xl mx-auto">
            Reserve your favorite table, PS5 station, or VIP cinema suite now.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/book"
              className="px-8 py-3.5 rounded-full text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary-hover shadow-xs transition-colors"
            >
              Book Now
            </Link>
            <Link
              href="/location"
              className="px-8 py-3.5 rounded-full text-xs font-bold bg-brand-surface-raised border border-brand-border text-brand-text-main hover:bg-brand-surface transition-colors"
            >
              Find Us on Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

