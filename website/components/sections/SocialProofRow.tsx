'use client';

export function SocialProofRow() {
  const stats = [
    { value: '3', label: 'Pro Snooker Tables', sub: 'Strachan slate cloth' },
    { value: '8+', label: 'PS5 Stations', sub: '4K 120Hz Displays' },
    { value: '120"', label: 'Laser Cinema', sub: 'Dolby Atmos 7.1' },
    { value: '24/7', label: 'Always Open', sub: 'Non-stop power backup' },
  ];

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="p-5 sm:p-6 rounded-2xl bg-brand-surface border border-brand-border flex flex-col justify-between"
          >
            <div className="text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight font-display">
              {stat.value}
            </div>
            <div className="mt-3">
              <div className="text-xs sm:text-sm font-bold text-brand-text-main">{stat.label}</div>
              <div className="text-[11px] text-brand-text-muted mt-0.5">{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
