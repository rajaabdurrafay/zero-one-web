'use client';

import { useState, useEffect, useRef, useId } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getPopupSettings, type SitePopupSettings } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { Arrow } from '@/components/redesign/ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function SitePopupModal() {
  const router = useRouter();
  const [popup, setPopup] = useState<SitePopupSettings | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // For CSS opacity transition
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function checkPopup() {
      try {
        const settings = await getPopupSettings();
        if (!settings || !settings.isEnabled) return;

        // Check Frequency rules
        if (settings.frequency === 'ONCE_PER_SESSION') {
          const sessionDismissed = sessionStorage.getItem('zeroone_popup_dismissed_session');
          if (sessionDismissed) return;
        } else if (settings.frequency === 'ONCE_PER_DAY') {
          const today = new Date().toISOString().slice(0, 10);
          const dayDismissed = localStorage.getItem('zeroone_popup_dismissed_date');
          if (dayDismissed === today) return;
        }

        setPopup(settings);

        // Wait for configured delay seconds
        const delayMs = Math.max(0, (settings.delaySeconds || 4) * 1000);
        timer = setTimeout(() => {
          setIsOpen(true);
          // slight RAF tick for smooth fade/scale transition
          requestAnimationFrame(() => {
            setIsVisible(true);
          });
        }, delayMs);
      } catch (err) {
        console.error('Error fetching site popup settings:', err);
      }
    }

    checkPopup();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const markDismissed = () => {
    if (!popup) return;
    if (popup.frequency === 'ONCE_PER_SESSION') {
      sessionStorage.setItem('zeroone_popup_dismissed_session', 'true');
    } else if (popup.frequency === 'ONCE_PER_DAY') {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('zeroone_popup_dismissed_date', today);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    markDismissed();
    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const handleActionClick = () => {
    if (!popup || !popup.buttonLink) return;
    markDismissed();
    setIsVisible(false);
    setTimeout(() => {
      setIsOpen(false);
    }, 300);

    const link = popup.buttonLink.trim();
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      router.push(link);
    }
  };

  if (!isOpen || !popup) return null;

  // Resolve image URL (prepend backend API base if relative /uploads path)
  const fullImageUrl = popup.imageUrl
    ? popup.imageUrl.startsWith('http') || popup.imageUrl.startsWith('data:')
      ? popup.imageUrl
      : `${API_BASE}${popup.imageUrl}`
    : null;

  return (
    <dialog
      ref={dialogRef}
      className={`zo-popup-overlay${isVisible ? ' is-visible' : ''}`}
      onClick={(event) => { if (event.target === event.currentTarget) handleClose(); }}
      onCancel={(event) => { event.preventDefault(); handleClose(); }}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      aria-modal="true"
    >
      <div
        className={`zo-popup-panel${fullImageUrl ? ' zo-popup-with-photo' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button X */}
        <button
          onClick={handleClose}
          aria-label="Close Announcement"
          type="button"
          className="zo-popup-close"
        >
          <Icon name="close" size={14} />
        </button>

        {/* Optional Header Banner Image */}
        {fullImageUrl && (
          <div className="zo-popup-photo">
            <Image
              src={fullImageUrl}
              alt={popup.heading || 'Announcement'}
              fill
              sizes="(max-width: 600px) 90vw, 340px"
              unoptimized={!fullImageUrl.startsWith(`${API_BASE}/uploads/`)}
            />
            <span className="zo-popup-photo-tag">ZeroOne Cue &amp; Play <Arrow /></span>
          </div>
        )}

        {/* Content Body */}
        <div className="zo-popup-copy">
          {/* Badge */}
            <span className="zo-eyebrow">
              Special Notice
            </span>

          {/* Heading */}
          <h2
            id={titleId}
          >
            {popup.heading}
          </h2>

          {/* Message */}
          <p
            id={messageId}
          >
            {popup.message}
          </p>

          {/* Actions */}
          <div className="zo-popup-actions">
            <button
              type="button"
              onClick={handleClose}
              className="zo-pill zo-pill-secondary"
            >
              Not now
            </button>

            <button
              type="button"
              onClick={handleActionClick}
              className="zo-pill"
            >
              <span>{popup.buttonText || 'Book Your Slot'}</span>
              <span className="zo-pill-arrow"><Arrow /></span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
