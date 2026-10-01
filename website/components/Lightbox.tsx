'use client';

import { useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Icon } from '@/components/Icon';
import type { GalleryImage } from '@/lib/api';

interface LightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, isOpen, onClose, onNavigate }: LightboxProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight') {
      onNavigate((currentIndex + 1) % images.length);
    }
    if (e.key === 'ArrowLeft') {
      onNavigate((currentIndex - 1 + images.length) % images.length);
    }
  }, [isOpen, currentIndex, images.length, onClose, onNavigate]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[currentIndex];

  const getFullImageUrl = (url: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (url.startsWith('/uploads/')) return `${apiBase}${url}`;
    return url;
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate((currentIndex + 1) % images.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate((currentIndex - 1 + images.length) % images.length);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Top Bar Navigation */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white text-sm font-bold tracking-widest pl-2">
          {currentIndex + 1} / {images.length}
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          aria-label="Close lightbox"
        >
          <Icon name="close" size={20} />
        </button>
      </div>

      {/* Main Image Container */}
      <div
        className="relative w-full max-w-6xl h-[70vh] sm:h-[80vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent close on image click
      >
        <Image
          src={getFullImageUrl(currentImage.imageUrl)}
          alt={currentImage.caption || 'Venue Photo'}
          fill
          className="object-contain"
          sizes="100vw"
          priority
          unoptimized={currentImage.imageUrl.startsWith('/uploads/')}
        />

        {/* Caption */}
        {currentImage.caption && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/70 backdrop-blur-md rounded-2xl border border-white/10 text-white text-sm font-semibold max-w-[90%] text-center">
            {currentImage.caption}
          </div>
        )}
      </div>

      {/* Side Navigation Buttons */}
      <button
        onClick={handlePrev}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
        aria-label="Previous image"
      >
        <Icon name="chevronLeft" size={24} />
      </button>

      <button
        onClick={handleNext}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-all active:scale-95"
        aria-label="Next image"
      >
        <Icon name="chevronRight" size={24} />
      </button>
    </div>
  );
}
