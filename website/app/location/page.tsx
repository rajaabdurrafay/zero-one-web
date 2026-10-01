import Link from 'next/link';
import Image from 'next/image';
import { Icon } from '@/components/Icon';

export const metadata = {
  title: 'Location & Hours â€” ZeroOne Cue & Play Karachi',
  description: 'Find ZeroOne Cue & Play at Kamran Chowrangi, Gulistan-e-Jauhar, Karachi. Open 24 hours every day with dedicated parking.',
};

export default function LocationPage() {
  const address = 'F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi';
  const phone = '0371-2160471';
  const email = 'info@cueandplay.pk';

  return (
    <div className="space-y-16 sm:space-y-24 pb-16 pt-24 sm:pt-28">
      {/* Header */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-xs font-bold text-brand-primary uppercase tracking-widest">
          <Icon name="target" size={13} />
          <span>Location &amp; Visiting Guide</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-brand-text-main tracking-tight">
          Find Us in <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-brand-accent to-brand-primary-hover">
            Gulistan-e-Jauhar, Karachi
          </span>
        </h1>
        <p className="text-brand-text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Centrally situated at Kamran Chowrangi. Fully air-conditioned, 24/7 power backup, dedicated parking, and open round the clock every single day.
        </p>
      </section>

      {/* Main Grid: Details + Map Embed */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Venue Details (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-brand-surface rounded-3xl border border-brand-border p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-black text-brand-text-main flex items-center gap-2.5">
                <Icon name="target" size={20} className="text-brand-primary" />
                <span>Venue Information</span>
              </h2>

              <div className="space-y-4 text-sm">
                <div className="p-4 rounded-2xl bg-brand-bg border border-brand-border space-y-1">
                  <span className="text-xs text-brand-primary font-bold uppercase tracking-wider block">
                    Full Address
                  </span>
                  <p className="text-brand-text-main font-bold leading-relaxed">{address}</p>
                  <p className="text-xs text-brand-text-muted">Landmark: Main Kamran Chowrangi, Gulistan-e-Jauhar</p>
                </div>

                <div className="p-4 rounded-2xl bg-brand-bg border border-brand-border space-y-1">
                  <span className="text-xs text-brand-success font-bold uppercase tracking-wider block">
                    Operating Schedule
                  </span>
                  <p className="text-brand-text-main font-black text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-success animate-pulse" />
                    Open 24 Hours / 7 Days a Week
                  </p>
                  <p className="text-xs text-brand-text-muted">Including all public holidays and weekends</p>
                </div>

                <div className="p-4 rounded-2xl bg-brand-bg border border-brand-border space-y-1">
                  <span className="text-xs text-brand-accent font-bold uppercase tracking-wider block">
                    Direct Phone / WhatsApp
                  </span>
                  <a
                    href={`tel:${phone}`}
                    className="text-brand-text-main font-black text-base hover:text-brand-accent transition-colors block font-mono"
                  >
                    {phone}
                  </a>
                  <p className="text-xs text-brand-text-muted">Call for table availability or direct queries</p>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <a
                  href="https://maps.google.com/?q=Kamran+Chowrangi+Gulistan-e-Jauhar+Karachi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl text-center text-sm font-black text-white bg-gradient-to-r from-brand-primary to-brand-accent hover:opacity-90 shadow-lg shadow-brand-primary/30 transition-all flex items-center justify-center gap-2"
                >
                  <Icon name="externalLink" size={15} />
                  <span>Open in Google Maps</span>
                </a>
                <Link
                  href="/book"
                  className="w-full py-3 px-4 rounded-xl text-center text-sm font-bold text-brand-text-muted bg-brand-bg hover:bg-brand-card border border-brand-border hover:text-brand-text-main transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Book a Slot Online First</span>
                  <span>â†’</span>
                </Link>
              </div>
            </div>

            {/* Venue Amenities */}
            <div className="bg-brand-surface rounded-3xl border border-brand-border p-6 space-y-4">
              <h3 className="text-sm font-bold text-brand-text-main uppercase tracking-wider">
                Venue Amenities &amp; Facilities
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs text-brand-text-muted">
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>24/7 Power Backup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>Sub-zero Central AC</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>Dedicated Bike/Car Parking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>High-speed Fiber WiFi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>Cafe &amp; Refreshments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="check" size={13} className="text-brand-success font-bold" />
                  <span>CCTV &amp; Guarded Security</span>
                </div>
              </div>
            </div>

            {/* Venue Entrance */}
            <div className="relative h-64 sm:h-72 rounded-3xl overflow-hidden border border-brand-border">
              <Image
                src="/images/receipon gate.webp"
                alt="ZeroOne Cue and Play Venue Entrance with Green LED Framing"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>

          {/* RIGHT: Map Box & Directions (lg:col-span-7) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Interactive Map Embed Container */}
            <div className="rounded-3xl bg-brand-surface border border-brand-border overflow-hidden shadow-2xl">
              <div className="p-4 bg-brand-bg border-b border-brand-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-brand-danger inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-brand-success inline-block" />
                  <span className="text-xs text-brand-text-muted font-bold ml-2">Kamran Chowrangi, Karachi</span>
                </div>
                <span className="text-xs text-brand-primary font-bold">Interactive Navigation</span>
              </div>

              <div className="h-[380px] sm:h-[450px] w-full bg-brand-bg relative">
                <iframe
                  title="ZeroOne Cue & Play Location Map"
                  src="https://maps.google.com/maps?q=Kamran+Chowrangi+Gulistan-e-Jauhar+Karachi&t=&z=15&ie=UTF8&iwloc=&output=embed"
                  className="w-full h-full border-0 filter grayscale-[20%] contrast-[110%]"
                  loading="lazy"
                  allowFullScreen
                />
              </div>
            </div>

            {/* How to Reach Us */}
            <div className="rounded-3xl bg-brand-surface border border-brand-border p-6 sm:p-8 space-y-4">
              <h3 className="text-lg font-black text-brand-text-main">How To Reach Us</h3>
              <div className="space-y-3 text-sm text-brand-text-muted leading-relaxed">
                <p>
                  <strong className="text-brand-text-main">From University Road / NIPA:</strong> Drive straight towards Kamran Chowrangi via Jauhar Chowrangi road. ZeroOne Cue & Play is situated right at the main Kamran Chowrangi commercial hub on the Mezzanine Floor.
                </p>
                <p>
                  <strong className="text-brand-text-main">From Pehlwan Goth / Jinnah Avenue:</strong> Head west towards Kamran Chowrangi. Ample parking is available in front of the building.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

