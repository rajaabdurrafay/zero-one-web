'use client';

import { experiences, imageRoot } from '@/components/redesign/content';
import { PageIntro } from '@/components/redesign/PageIntro';
import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { getPublicGallery, type GalleryImage } from '@/lib/api';
import dynamic from 'next/dynamic';
const Lightbox=dynamic(()=>import('@/components/Lightbox').then(module=>module.Lightbox),{ssr:false});
import { Icon } from '@/components/Icon';

const venueGallery: GalleryImage[] = experiences.map((experience, index) => ({
  id: `venue-${experience.type}`, imageUrl: `${imageRoot}/${experience.image}`,
  caption: experience.name, category: experience.name, displayOrder: index,
  isActive: true, createdAt: '',
}));

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    getPublicGallery()
      .then((data) => setImages(data.length ? data : venueGallery))
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
    <div className="space-y-12 sm:space-y-16 zo-page-spacing">
      {/* Top Banner Header */}
      <PageIntro label="Gallery" title="A look inside." description="The tables, the screens, the spaces. Explore ZeroOne before your next visit." image="/images/Snokker/snooker-table.jpg (3).webp" />

      {/* Category Filter Tabs */}
      {categories.length > 1 && (
        <section className="zo-page-container">
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
      <section className="zo-page-container">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredImages.length === 0 ? (
          <div className="text-center py-20 bg-brand-surface border border-brand-border rounded-3xl zo-panel text-brand-text-muted text-sm">
            No gallery photos uploaded yet. Check back soon!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredImages.map((image, index) => (
              <button
                type="button" aria-label={`View ${image.caption || 'venue photo'}`}
                key={image.id}
                onClick={() => openLightbox(index)}
                className="group relative h-64 sm:h-72 rounded-3xl zo-panel overflow-hidden bg-brand-surface border border-brand-border cursor-pointer shadow-xs transition-all hover:shadow-md hover:border-brand-primary/50"
              >
                <Image
                  src={getFullImageUrl(image.imageUrl)}
                  alt={image.caption || 'ZeroOne Gallery'}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"

                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                  {image.caption && (
                    <p className="!text-white text-sm font-bold line-clamp-2">{image.caption}</p>
                  )}
                  {image.category && (
                    <span className="text-white text-[10px] font-extrabold uppercase tracking-widest mt-1">
                      {image.category}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox Overlay */}
      {lightboxOpen && <Lightbox
        images={filteredImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(newIdx) => setLightboxIndex(newIdx)}
      />}
    </div>
  );
}
