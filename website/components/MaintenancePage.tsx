import Image from 'next/image';
import { Icon } from '@/components/Icon';

interface MaintenancePageProps {
  message?: string | null;
  contactPhone?: string | null;
}

export function MaintenancePage({ message, contactPhone }: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-[#07090e] text-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle Background Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl mx-auto text-center relative z-10 space-y-8">
        {/* Brand Logo */}
        <div className="inline-block p-4 rounded-3xl bg-[#0e131f]/80 border border-white/10 shadow-2xl backdrop-blur-md">
          <Image
            src="/logo.png"
            alt="ZeroOne Cue & Play"
            width={180}
            height={50}
            className="h-10 sm:h-12 w-auto object-contain mx-auto drop-shadow-[0_0_15px_rgba(212,169,79,0.3)]"
            priority
          />
        </div>

        {/* Status Chip */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            Scheduled Maintenance
          </span>
        </div>

        {/* Headings */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-tight font-display">
            We&#39;ll Be Back Shortly
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-md mx-auto leading-relaxed">
            {message || 'We are currently undergoing scheduled maintenance and system upgrades to enhance your gaming experience.'}
          </p>
        </div>

        {/* Details Card */}
        <div className="p-6 rounded-2xl bg-[#0f1422]/70 border border-white/10 backdrop-blur-md text-left space-y-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Icon name="sparkles" size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Direct Inquiries & Arena Access</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Our physical lounge remains open. For urgent slot reservations or walk-in inquiries, call us directly:
              </p>
              <div className="mt-2.5">
                <a
                  href={`tel:${(contactPhone || '+92 300 1234567').replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold transition-all"
                >
                  <Icon name="phone" size={12} />
                  <span>{contactPhone || '+92 300 1234567'}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-slate-600 font-mono">
          ZeroOne Cue & Play // Kamran Chowrangi, Gulistan-e-Jauhar, Karachi
        </p>
      </div>
    </div>
  );
}
