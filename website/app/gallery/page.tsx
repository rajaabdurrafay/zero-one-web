'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getPublicGallery, type GalleryImage } from '@/lib/api';
import { Lightbox } from '@/components/Lightbox';
import { Icon } from '@/components/Icon';

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    getPublicGallery()
      .then((data) => setImages(data))
      .finally(() => setLoading(false));
  }, []);

  // Compute Categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    images.forEach((img) => {
      if (img.category) cats.add(img.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [images]);

  // Filtered Images
  const filteredImages = useMemo(() => {
    if (selectedCategory === 'ALL') return images;
    return images.filter((img) => img.category === selectedCategory);
  }, [images, selectedCategory]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const getFullImageUrl = (url: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (url.startsWith('/uploads/')) return `${apiBase}${url}`;
    return url;
  };

  return (
    <div className="space-y-12 sm:space-y-16 pb-20 pt-24 sm:pt-28">
      {/* Top Banner Header */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface-raised border border-brand-border text-xs font-semibold text-brand-text-muted">
          <Icon name="camera" size={13} className="text-brand-primary" />
          <span>Visual Showcase</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-brand-text-main tracking-tight leading-[0.95]">
          ZeroOne Venue <br />
          <span className="text-brand-primary">Photo Gallery</span>
        </h1>
        <p className="text-brand-text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Take a look inside our tournament snooker hall, luxury PS5 suites, 120&quot; 4K laser cinema, and motion racing rigs.
        </p>
      </section>

      {/* Category Filter Tabs */}
      {categories.length > 1 && (
        <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all min-h-[44px] sm:min-h-0 ${
                  selectedCategory === cat
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-brand-surface border border-brand-border text-brand-text-muted hover:text-brand-text-main'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Gallery Grid */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-20 bg-brand-surface border border-brand-border rounded-3xl text-brand-text-muted text-sm">
            No gallery photos uploaded yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image, index) => (
              <div
                key={image.id}
                onClick={() => openLightbox(index)}
                className="group relative h-64 sm:h-72 rounded-3xl overflow-hidden bg-brand-surface border border-brand-border cursor-pointer shadow-xs transition-all hover:shadow-md hover:border-brand-primary/50"
              >
                <Image
                  src={getFullImageUrl(image.imageUrl)}
                  alt={image.caption || 'ZeroOne Gallery'}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  unoptimized={image.imageUrl.startsWith('/uploads/')}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                  {image.caption && (
                    <p className="text-white text-sm font-bold line-clamp-2">{image.caption}</p>
                  )}
                  {image.category && (
                    <span className="text-brand-primary text-[10px] font-extrabold uppercase tracking-widest mt-1">
                      {image.category}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Overlay */}
      <Lightbox
        images={filteredImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />
    </div>
  );
}

