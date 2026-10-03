'use client';

import { useState, useEffect, useRef } from 'react';
import { getPublicReels, type SocialReel } from '@/lib/api';
import { Icon } from '@/components/Icon';

const DEFAULT_REELS:SocialReel[]=[];

export function SocialReelsSection() {
  const [reels, setReels] = useState<SocialReel[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPublicReels()
      .then((data) => {
        if (data && data.length > 0) {
          setReels(data);
        } else {
          setReels(DEFAULT_REELS);
        }
      })
      .catch(() => {
        setReels(DEFAULT_REELS);
      })
      .finally(() => setLoading(false));
  }, []);

  // Auto-scroll carousel effect
  useEffect(() => {
    if (!isAutoScrolling || playingId) return;
    const interval = setInterval(() => {
      if (sliderRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = sliderRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 20) {
          sliderRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          sliderRef.current.scrollBy({ left: 320, behavior: 'smooth' });
        }
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isAutoScrolling, playingId]);

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -320, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 320, behavior: 'smooth' });
    }
  };

  const getFullThumbnailUrl = (url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('/uploads/')) return `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${url}`;
    if (url.startsWith('/images/')) return url;
    return url;
  };

  const getCleanEmbedUrl = (reel: SocialReel) => {
    const url = reel.url || '';

    if (url.includes('instagram.com')) {
      const match = url.match(/(?:p|reel|reels)\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://www.instagram.com/p/${match[1]}/embed/?cr=1&v=14&wp=540&rd=https%3A%2F%2Fwww.instagram.com`;
      }
    }

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const match = url.match(/(?:shorts\/|v=|v\/|embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`;
      }
    }

    if (url.includes('tiktok.com')) {
      const match = url.match(/video\/(\d+)/);
      if (match && match[1]) {
        return `https://www.tiktok.com/embed/v2/${match[1]}`;
      }
    }

    return url;
  };

  const getPlatformDetails = (platform: string) => {
    switch (platform?.toUpperCase()) {
      case 'TIKTOK':
        return {
          name: 'TikTok',
          badgeColor: 'bg-black text-cyan-400 border-cyan-500/30',
          dot: 'bg-cyan-400',
          bgGradient: 'from-black via-zinc-900 to-cyan-950/40',
        };
      case 'YOUTUBE':
        return {
          name: 'YouTube',
          badgeColor: 'bg-red-500/10 text-red-500 border-red-500/20',
          dot: 'bg-red-500',
          bgGradient: 'from-zinc-950 via-zinc-900 to-red-950/40',
        };
      default:
        return {
          name: 'Instagram',
          badgeColor: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
          dot: 'bg-pink-500',
          bgGradient: 'from-zinc-950 via-purple-950/40 to-pink-950/50',
        };
    }
  };

  if (!loading && reels.length === 0) return null;

  return (
    <section
      className="w-full py-12 sm:py-16 bg-brand-surface/30 border-y border-brand-border/40 overflow-hidden relative"
      onMouseEnter={() => setIsAutoScrolling(false)}
      onMouseLeave={() => setIsAutoScrolling(true)}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with Slider Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">
                Featured Reels & Videos
              </span>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-500 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                <span>@cueandplay.pk</span>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
              Watch Our Reels
            </h2>
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2 self-start sm:self-end">
            <button
              onClick={scrollLeft}
              className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text-main hover:bg-brand-surface-raised transition-colors cursor-pointer shadow-xs"
              title="Scroll Left"
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <button
              onClick={scrollRight}
              className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text-main hover:bg-brand-surface-raised transition-colors cursor-pointer shadow-xs"
              title="Scroll Right"
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Carousel Container */}
      <div className="relative w-full">
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-brand-bg to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-brand-bg to-transparent z-10 pointer-events-none" />

        <div
          ref={sliderRef}
          className="flex gap-5 overflow-x-auto no-scrollbar px-4 sm:px-8 pb-4 pt-1 snap-x snap-mandatory scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {reels.map((reel) => {
            const details = getPlatformDetails(reel.platform);
            const isPlaying = playingId === reel.id;
            const rawThumb = getFullThumbnailUrl(reel.thumbnailUrl);
            const hasFailed = failedImages[reel.id];
            const shouldShowImage = rawThumb && !hasFailed;

            return (
              <div
                key={reel.id}
                className="group relative flex-shrink-0 w-[260px] sm:w-[280px] snap-start flex flex-col rounded-3xl bg-brand-surface border border-brand-border overflow-hidden shadow-xs hover:shadow-md transition-all duration-300"
              >
                {/* Media Container (9:16 vertical aspect ratio) */}
                <div className="relative w-full aspect-[9/16] bg-brand-surface-raised overflow-hidden">
                  {isPlaying ? (
                    <div className="absolute inset-0 w-full h-full bg-black z-10 flex flex-col">
                      <button
                        onClick={() => setPlayingId(null)}
                        className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-black/80 border border-white/20 text-white flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer shadow-lg"
                        title="Close Player"
                      >
                        <Icon name="close" size={16} />
                      </button>
                      <iframe
                        src={getCleanEmbedUrl(reel)}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        scrolling="no"
                      />
                    </div>
                  ) : (
                    <>
                      {shouldShowImage ? (
                        <img
                          src={rawThumb}
                          alt={reel.caption || `${reel.platform} Reel`}
                          onError={() => {
                            setFailedImages((prev) => ({ ...prev, [reel.id]: true }));
                          }}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${details.bgGradient} flex flex-col items-center justify-center p-6 text-center`}>
                          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-3 shadow-inner group-hover:scale-110 transition-transform">
                            <Icon name="video" size={24} className="text-white" />
                          </div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                            {details.name} Video
                          </span>
                          <p className="text-[11px] text-white/50 mt-1 line-clamp-2">
                            {reel.caption || 'Click below to watch inline'}
                          </p>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/30 pointer-events-none" />

                      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${details.badgeColor}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${details.dot}`} />
                          {details.name}
                        </span>

                        <div className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                          <Icon name="video" size={13} />
                        </div>
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col justify-end space-y-2.5">
                        {reel.caption && (
                          <p className="text-white text-xs font-medium line-clamp-2 drop-shadow-sm leading-snug">
                            {reel.caption}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <button
                            onClick={() => setPlayingId(reel.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-brand-primary text-white text-[11px] font-bold shadow-md hover:bg-brand-primary/90 transition-colors cursor-pointer"
                          >
                            <Icon name="video" size={12} />
                            <span>Watch</span>
                          </button>
                          <a
                            href={reel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-white/70 hover:text-white uppercase tracking-wider font-mono underline"
                          >
                            Original ↗
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
