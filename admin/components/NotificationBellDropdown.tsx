'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Icon } from '@/components/Icon';
import { getBookings, getMessages, getReviews, type Booking, type ContactMessage, type Review } from '@/lib/api';

export interface AppNotificationItem {
  id: string;
  type: 'BOOKING' | 'PAYMENT' | 'MESSAGE' | 'REVIEW';
  title: string;
  description: string;
  link: string;
  timestamp: string;
  read: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
  SNOOKER: 'Snooker',
  PS5_OPEN: 'PS5 Open',
  PS5_PRIVATE: 'PS5 Private',
  CINEMA: 'Cinema',
  TABLE_TENNIS: 'Table Tennis',
  CAR_SIMULATOR: 'Car Simulator',
};

function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'Just now';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function NotificationBellDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load read notification IDs from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('gz_read_notification_ids');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    try {
      localStorage.setItem('gz_read_notification_ids', JSON.stringify(Array.from(newSet)));
    } catch {
      // ignore
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Poll recent bookings (last 10)
  const { data: bookingsData } = useSWR<Booking[]>(
    'zeroone-recent-bookings',
    () => getBookings({ sortBy: 'createdAt', sortOrder: 'desc',limit:20 }),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  // Poll pending payment verifications
  const { data: verificationsData } = useSWR<Booking[]>(
    'zeroone-pending-verifications',
    () => getBookings({ status: 'AWAITING_VERIFICATION', sortBy: 'paymentSubmittedAt', sortOrder: 'desc' }),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  // Poll unread messages
  const { data: messagesData } = useSWR<ContactMessage[]>(
    'bell-messages-list',
    () => getMessages({ isRead: false, sortOrder: 'desc' }),
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  // Poll pending reviews
  const { data: reviewsData } = useSWR<Review[]>(
    'zeroone-pending-reviews',
    () => getReviews('pending'),
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  // Build combined notification items (up to 15 items)
  const items: AppNotificationItem[] = [];

  if (Array.isArray(bookingsData)) {
    bookingsData.slice(0, 10).forEach((b) => {
      const activity = b.resource?.type ? (RESOURCE_LABELS[b.resource.type] || b.resource.name) : (b.resource?.name || 'Arena');
      items.push({
        id: `b_${b.id}`,
        type: 'BOOKING',
        title: 'New Booking',
        description: `${activity} — ${b.customer?.name || 'Customer'} (₨${(b.totalPrice || 0).toLocaleString()})`,
        link: `/bookings/${b.id}`,
        timestamp: b.createdAt,
        read: readIds.has(`b_${b.id}`),
      });
    });
  }

  if (Array.isArray(verificationsData)) {
    verificationsData.slice(0, 5).forEach((b) => {
      items.push({
        id: `v_${b.id}`,
        type: 'PAYMENT',
        title: 'Payment Verification Needed',
        description: `Proof submitted by ${b.customer?.name || 'Customer'}`,
        link: `/bookings/${b.id}`,
        timestamp: b.paymentSubmittedAt || b.createdAt,
        read: readIds.has(`v_${b.id}`),
      });
    });
  }

  if (Array.isArray(messagesData)) {
    messagesData.slice(0, 5).forEach((m) => {
      items.push({
        id: `m_${m.id}`,
        type: 'MESSAGE',
        title: 'Contact Message',
        description: `${m.name}: "${m.message.slice(0, 45)}${m.message.length > 45 ? '...' : ''}"`,
        link: '/messages',
        timestamp: m.createdAt,
        read: m.isRead || readIds.has(`m_${m.id}`),
      });
    });
  }

  if (Array.isArray(reviewsData)) {
    reviewsData.slice(0, 5).forEach((r) => {
      items.push({
        id: `r_${r.id}`,
        type: 'REVIEW',
        title: 'New Customer Review',
        description: `${r.customerName} rated ${r.rating}★: "${r.reviewText.slice(0, 40)}${r.reviewText.length > 40 ? '...' : ''}"`,
        link: '/reviews',
        timestamp: r.createdAt,
        read: readIds.has(`r_${r.id}`),
      });
    });
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const displayItems = items.slice(0, 15);

  const unreadCount = displayItems.filter((i) => !i.read).length;

  const handleMarkAllRead = () => {
    const updated = new Set(readIds);
    displayItems.forEach((i) => updated.add(i.id));
    saveReadIds(updated);
  };

  const handleItemClick = (item: AppNotificationItem) => {
    const updated = new Set(readIds);
    updated.add(item.id);
    saveReadIds(updated);
    setIsOpen(false);
    router.push(item.link);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2 rounded-lg text-muted hover:text-text hover:bg-panel border border-transparent hover:border-line transition-all flex items-center justify-center cursor-pointer"
      >
        <Icon name="bell" size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[17px] h-[17px] px-1 text-[10px] font-mono font-bold text-white bg-stop rounded-full shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-panel border border-line rounded-xl shadow-2xl z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text">Notifications</span>
              {unreadCount > 0 && (
                <span className="pill pill-stop text-[10px] px-1.5 py-0.2">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-faint hover:text-brass transition-colors font-medium cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-line/60">
            {displayItems.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted">
                No notifications right now
              </div>
            ) : (
              displayItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-3 cursor-pointer hover:bg-surface/80 transition-colors flex items-start gap-3 ${
                    !item.read ? 'bg-surface/40' : 'opacity-70'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {item.type === 'BOOKING' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <Icon name="calendar" size={14} />
                      </div>
                    )}
                    {item.type === 'PAYMENT' && (
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Icon name="receipt" size={14} />
                      </div>
                    )}
                    {item.type === 'MESSAGE' && (
                      <div className="w-7 h-7 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <Icon name="message" size={14} />
                      </div>
                    )}
                    {item.type === 'REVIEW' && (
                      <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <Icon name="star" size={14} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-text truncate">{item.title}</p>
                      <span className="text-[10px] text-muted shrink-0">{formatTimeAgo(item.timestamp)}</span>
                    </div>
                    <p className="text-[11.5px] text-muted truncate mt-0.5">{item.description}</p>
                  </div>

                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-stop shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
