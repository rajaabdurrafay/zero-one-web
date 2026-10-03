'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { Icon, type IconName } from '@/components/Icon';
import { AdminRole, AdminUser } from '@/lib/auth';
import { getUnreadMessageCount, getBookings, getAdminMe, getRemindersDue, getActiveSessionsList, getReviews, type Booking, type LiveSession } from '@/lib/api';
import useSWR from 'swr';
import { AdminThemeToggle } from '@/components/AdminThemeToggle';
import { NotificationManager } from '@/components/NotificationManager';
import { NotificationBellDropdown } from '@/components/NotificationBellDropdown';
import { playNotificationSound } from '@/lib/sound';
import { BrandLogo } from '@/components/BrandLogo';

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  allowedRoles: AdminRole[];
  hasBadge?: boolean;
}

const allNavItems: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/sessions', label: 'Live Sessions', icon: 'clock', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'], hasBadge: true },
  { href: '/new-booking', label: 'New Booking', icon: 'plus', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/bookings', label: 'Bookings', icon: 'calendar', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/reminders', label: 'Reminders', icon: 'bell', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'], hasBadge: true },
  { href: '/timeline', label: 'Venue Timeline', icon: 'clock', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/customers', label: 'Customers', icon: 'user', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/messages', label: 'Messages', icon: 'message', allowedRoles: ['SUPER_ADMIN', 'MANAGER'], hasBadge: true },
  { href: '/analytics', label: 'Analytics', icon: 'analytics', allowedRoles: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/addons', label: 'Add-ons / Café', icon: 'coffee', allowedRoles: ['SUPER_ADMIN', 'MANAGER', 'RECEPTIONIST'] },
  { href: '/offers', label: 'Deals & Offers', icon: 'tag', allowedRoles: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/gallery', label: 'Gallery', icon: 'image', allowedRoles: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/reels', label: 'Social Reels', icon: 'video', allowedRoles: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/reviews', label: 'Reviews', icon: 'star', allowedRoles: ['SUPER_ADMIN', 'MANAGER'], hasBadge: true },
  { href: '/pricing', label: 'Pricing', icon: 'money', allowedRoles: ['SUPER_ADMIN', 'MANAGER'] },
  { href: '/appearance', label: 'Appearance', icon: 'palette', allowedRoles: ['SUPER_ADMIN'] },
  { href: '/settings', label: 'Settings', icon: 'settings', allowedRoles: ['SUPER_ADMIN'] },
  { href: '/staff', label: 'Staff Management', icon: 'users', allowedRoles: ['SUPER_ADMIN'] },
  { href: '/attendance', label: 'Staff Attendance', icon: 'clock', allowedRoles: ['SUPER_ADMIN'] },
  { href: '/audit-logs', label: 'Audit Logs', icon: 'shield', allowedRoles: ['SUPER_ADMIN'] },
];

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

function FloorClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return <div className="h-[30px] w-[104px]" aria-hidden />;
  }

  const time = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="text-right leading-none">
      <div className="display tnum text-[20px] sm:text-[22px] text-text">{time}</div>
      <div className="eyebrow mt-0.5 text-[9px] sm:text-[11px]">
        {now.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  const [userRole, setUserRole] = useState<AdminRole>('SUPER_ADMIN');
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const isInitialMessagesMount = useRef(true);
  const prevUnreadCount = useRef<number>(0);

  // Poll pending payment verifications count for persistent header pill and sidebar badge
  const { data: pendingVerificationsList } = useSWR<Booking[]>(
    'zeroone-pending-verifications',
    () => getBookings({ status: 'AWAITING_VERIFICATION', sortBy: 'paymentSubmittedAt', sortOrder: 'desc' }),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Poll reminders due (confirmed bookings in 30-60 min)
  const { data: remindersDueList } = useSWR<Booking[]>(
    'global-reminders-due-count',
    () => getRemindersDue(),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  // Poll active live sessions count for sidebar badge
  const { data: activeSessionsList } = useSWR<LiveSession[]>(
    'zeroone-active-sessions',
    () => getActiveSessionsList(),
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  // Poll pending reviews count for sidebar badge
  const { data: pendingReviewsList } = useSWR(
    'zeroone-pending-reviews',
    () => getReviews('pending'),
    {
      refreshInterval: 10000,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    }
  );

  const pendingPaymentsCount = Array.isArray(pendingVerificationsList) ? pendingVerificationsList.length : 0;
  const remindersDueCount = Array.isArray(remindersDueList) ? remindersDueList.length : 0;
  const activeSessionsCount = Array.isArray(activeSessionsList) ? activeSessionsList.length : 0;
  const pendingReviewsCount = Array.isArray(pendingReviewsList) ? pendingReviewsList.length : 0;

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const userAvatarSrc = currentUser?.avatarUrl
    ? currentUser.avatarUrl.startsWith('http')
      ? currentUser.avatarUrl
      : `${API_BASE}${currentUser.avatarUrl}`
    : null;

  const fetchUnreadCount = useCallback(async () => {
    if (userRole === 'RECEPTIONIST') return;
    try {
      const res = await getUnreadMessageCount();
      const count = res.unreadCount || 0;
      setUnreadMessages(count);

      if (isInitialMessagesMount.current) {
        prevUnreadCount.current = count;
        isInitialMessagesMount.current = false;
      } else {
        if (count > prevUnreadCount.current) {
          const diff = count - prevUnreadCount.current;
          playNotificationSound();
          toast.custom(
            (t) => (
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  router.push('/messages');
                }}
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white dark:bg-[#0f2420] shadow-2xl rounded-xl pointer-events-auto flex ring-1 ring-black/10 dark:ring-white/10 border border-rose-500/30 p-3.5 cursor-pointer hover:border-rose-500 transition-all`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      New Contact Message
                    </p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    You have <span className="font-bold text-rose-600 dark:text-rose-400">{diff === 1 ? '1 new message' : `${diff} new messages`}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    Click to open messages inbox
                  </p>
                </div>
              </div>
            ),
            { duration: 5000 }
          );
        }
        prevUnreadCount.current = count;
      }
    } catch (e) {
      // ignore
    }
  }, [userRole, router]);

  useEffect(() => {
    // Read user information from cookies
    const roleCookie = getCookie('gz-admin-role') as AdminRole | null;
    const userCookie = getCookie('gz-admin-user');

    if (roleCookie) {
      setUserRole(roleCookie);
    }

    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        setCurrentUser(parsed);
        if (parsed.role) setUserRole(parsed.role);
      } catch (e) {
        console.error('Failed to parse user cookie', e);
      }
    }

    // Always fetch fresh profile info (e.g. updated avatarUrl) from /api/auth/admin/me
    getAdminMe()
      .then((res) => {
        if (res?.user) {
          setCurrentUser((prev) => ({
            ...(prev || {}),
            ...res.user,
          }));
          if (res.user.role) setUserRole(res.user.role);
          // Keep cookie in sync
          if (typeof document !== 'undefined') {
            document.cookie = `gz-admin-user=${encodeURIComponent(JSON.stringify(res.user))}; path=/; max-age=604800; SameSite=Lax`;
          }
        }
      })
      .catch(() => {
        // Silently ignore if unauthenticated or offline
      });

    const handleProfileUpdate = () => {
      getAdminMe()
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
            if (typeof document !== 'undefined') {
              document.cookie = `gz-admin-user=${encodeURIComponent(JSON.stringify(res.user))}; path=/; max-age=604800; SameSite=Lax`;
            }
          }
        })
        .catch(() => {});
    };

    window.addEventListener('refresh-admin-profile', handleProfileUpdate);
    return () => {
      window.removeEventListener('refresh-admin-profile', handleProfileUpdate);
    };
  }, []);

  // Poll for unread contact messages every 15 seconds
  useEffect(() => {
    if (userRole === 'SUPER_ADMIN' || userRole === 'MANAGER') {
      fetchUnreadCount();
      const interval = setInterval(fetchUnreadCount, 15000);

      const handleCustomRefresh = () => fetchUnreadCount();
      window.addEventListener('refresh-messages-count', handleCustomRefresh);

      return () => {
        clearInterval(interval);
        window.removeEventListener('refresh-messages-count', handleCustomRefresh);
      };
    }
  }, [userRole, fetchUnreadCount]);

  // Filter navigation items by active user's role
  const visibleNavItems = allNavItems.filter((item) => item.allowedRoles.includes(userRole));

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const current = allNavItems.find((i) => i.href === pathname);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout failed:', err);
      setLoggingOut(false);
    }
  }

  function getRoleBadge(role: AdminRole) {
    switch (role) {
      case 'SUPER_ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Icon name="shield" size={11} />
            <span>Super Admin</span>
          </span>
        );
      case 'MANAGER':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
            <Icon name="user" size={11} />
            <span>Manager</span>
          </span>
        );
      case 'RECEPTIONIST':
        return (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <Icon name="play" size={11} />
            <span>Receptionist</span>
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen lg:flex bg-ink text-text">
      <NotificationManager />
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-[260px] 2xl:w-[280px] lg:flex-col lg:fixed lg:inset-y-0 glass-nav bg-panel border-r border-line shadow-sm z-30">
        <div className="px-5 py-5 border-b border-line-soft">
          <Link href="/" className="block group">
            <div className="bg-[#0b1b17] border border-[#1c4b42]/40 rounded-2xl p-4 flex flex-col items-center justify-center shadow-md group-hover:border-[#d4a94f]/50 transition-all duration-300">
              <BrandLogo
                width={200}
                height={70}
                className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_12px_rgba(212,169,79,0.25)]"
                priority
              />
              <span className="text-[9px] font-mono text-[#d4a94f] uppercase tracking-[0.2em] font-bold mt-2 pt-1.5 border-t border-[#1c4b42]/40 w-full text-center">
                Console // OPS
              </span>
            </div>
          </Link>
        </div>

        {/* User Role & Navigation */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          <p className="eyebrow px-3 pb-2 text-[10px]">Operations Menu</p>
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href;
            const badgeCount =
              item.href === '/sessions'
                ? activeSessionsCount
                : item.href === '/reminders'
                ? remindersDueCount
                : item.href === '/bookings'
                ? pendingPaymentsCount
                : item.href === '/reviews'
                ? pendingReviewsCount
                : item.hasBadge
                ? unreadMessages
                : 0;
            const showBadge = badgeCount > 0;
            const badgeColor =
              item.href === '/sessions'
                ? 'bg-amber-500'
                : item.href === '/reminders'
                ? 'bg-emerald-500'
                : item.href === '/reviews'
                ? 'bg-amber-500'
                : 'bg-stop';

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13.5px] font-semibold transition-all ${
                  isActive
                    ? 'text-brass bg-brass/10 shadow-sm font-bold'
                    : 'text-muted hover:text-text hover:bg-raised'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </div>
                {showBadge && (
                  <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold text-white ${badgeColor} rounded-full shadow-xs`}>
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Fixed Footer Section */}
        <div className="p-3 border-t border-line-soft bg-subtle/40 space-y-3 shrink-0">
          {/* View Public Site Link */}
          <a
            href={process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3002'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-semibold text-muted hover:text-brass hover:bg-brass/10 border border-transparent hover:border-brass/20 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Icon name="externalLink" size={15} className="text-muted group-hover:text-brass transition-colors" />
              <span>View public site</span>
            </div>
            <span className="text-[10px] text-faint group-hover:text-brass/70 font-mono">↗</span>
          </a>

          {/* Subtle Divider */}
          <div className="border-t border-line-soft/80" />

          {/* User Profile Card */}
          <div className="flex items-center gap-3 px-2 py-1">
            {userAvatarSrc ? (
              <img
                src={userAvatarSrc}
                alt={currentUser?.name || 'User'}
                className="w-9 h-9 rounded-full object-cover border border-brass/40 shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-brass/20 text-brass border border-brass/30 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                {(currentUser?.name || 'A').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-text truncate leading-tight">
                {currentUser?.name || 'Administrator'}
              </p>
              <div className="mt-1">
                {getRoleBadge(userRole)}
              </div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center gap-2 text-[12.5px] font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-xl py-2 px-3 w-full transition-all disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Icon name="logout" size={15} />
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile / Tablet Drawer (Slide-over off-canvas) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-panel border-r border-line shadow-2xl z-50 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-line-soft">
              <div className="bg-[#0b1b17] border border-[#1c4b42]/40 rounded-xl px-3 py-1.5 flex items-center shadow-sm">
                <BrandLogo
                  width={120}
                  height={40}
                  className="h-7 w-auto object-contain"
                />
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-muted hover:text-text hover:bg-raised"
                aria-label="Close menu"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              <p className="eyebrow px-3 pb-2 text-[10px]">Operations Menu</p>
              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href;
                const badgeCount =
                  item.href === '/'
                    ? remindersDueCount
                    : item.href === '/bookings'
                    ? pendingPaymentsCount
                    : item.href === '/reviews'
                    ? pendingReviewsCount
                    : item.hasBadge
                    ? unreadMessages
                    : 0;
                const showBadge = badgeCount > 0;
                const badgeColor = item.href === '/' ? 'bg-emerald-500' : 'bg-stop';

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-[14px] font-semibold transition-all ${
                      isActive
                        ? 'text-brass bg-brass/10 shadow-sm'
                        : 'text-muted hover:text-text hover:bg-raised'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <Icon name={item.icon} size={20} />
                      <span>{item.label}</span>
                    </div>
                    {showBadge && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-bold text-white ${badgeColor} rounded-full shadow-xs`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile Footer Section */}
            <div className="p-4 border-t border-line-soft bg-subtle/40 space-y-3 shrink-0">
              <a
                href={process.env.NEXT_PUBLIC_WEBSITE_URL || 'http://localhost:3002'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-semibold text-muted hover:text-brass hover:bg-brass/10 border border-transparent hover:border-brass/20 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon name="externalLink" size={16} className="text-muted group-hover:text-brass transition-colors" />
                  <span>View public site</span>
                </div>
                <span className="text-[11px] text-faint group-hover:text-brass/70 font-mono">↗</span>
              </a>

              <div className="border-t border-line-soft/80" />

              <div className="flex items-center gap-3 px-1 py-0.5">
                {userAvatarSrc ? (
                  <img
                    src={userAvatarSrc}
                    alt={currentUser?.name || 'User'}
                    className="w-9 h-9 rounded-full object-cover border border-brass/40 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-brass/20 text-brass border border-brass/30 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    {(currentUser?.name || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-text truncate leading-tight">
                    {currentUser?.name || 'Administrator'}
                  </p>
                  <div className="mt-1">
                    {getRoleBadge(userRole)}
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex items-center justify-center gap-2 text-[13px] font-semibold text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 rounded-xl py-2.5 px-4 w-full transition-all disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Icon name="logout" size={16} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 lg:ml-[260px] 2xl:ml-[280px] flex flex-col min-w-0">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 glass-nav bg-panel/90 backdrop-blur-md border-b border-line-soft shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <div className="w-full max-w-[1600px] mx-auto flex items-center justify-between gap-3 sm:gap-4 px-4 sm:px-8 2xl:px-12 h-[64px] sm:h-[68px]">
            <div className="flex items-center gap-3 min-w-0">
              {/* Hamburger Button for Mobile / Tablet */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-lg text-muted hover:text-text hover:bg-raised focus:outline-none"
                aria-label="Open Navigation Menu"
              >
                <Icon name="menu" size={22} />
              </button>

              <Link href="/" className="lg:hidden shrink-0">
                <div className="bg-[#0b1b17] border border-[#1c4b42]/40 rounded-xl px-2.5 py-1.5 flex items-center shadow-sm">
                  <Image
                    src="/logo.png"
                    alt="ZEROONE Cue & Play"
                    width={100}
                    height={35}
                    className="h-6 w-auto object-contain drop-shadow-[0_0_8px_rgba(212,169,79,0.2)]"
                  />
                </div>
              </Link>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[17px] sm:text-[20px] font-bold text-text truncate">
                  {current?.label ?? 'Management'}
                </h1>
                <div className="hidden sm:inline-block">
                  {getRoleBadge(userRole)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Notification Bell with Dropdown */}
              <NotificationBellDropdown />

              {/* Persistent Reminders Due Pill */}
              {remindersDueCount > 0 && (
                <Link
                  href="/reminders"
                  className="hidden md:inline-flex pill pill-live hover:brightness-110 transition-all cursor-pointer border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                >
                  <Icon name="bell" size={13} className="text-emerald-400 mr-1" />
                  <span>
                    {remindersDueCount} {remindersDueCount === 1 ? 'Reminder' : 'Reminders'} Due
                  </span>
                </Link>
              )}

              {/* Persistent Pending Payments Pill */}
              {pendingPaymentsCount > 0 && (
                <Link
                  href="/bookings?status=AWAITING_VERIFICATION"
                  className="hidden md:inline-flex pill pill-stop hover:brightness-110 transition-all cursor-pointer"
                >
                  <span>
                    {pendingPaymentsCount} {pendingPaymentsCount === 1 ? 'Payment' : 'Payments'} Pending
                  </span>
                </Link>
              )}

              {/* If on other pages, small indicator of unread messages */}
              {unreadMessages > 0 && pathname !== '/messages' && (
                <Link
                  href="/messages"
                  className="hidden md:inline-flex pill pill-stop hover:brightness-110 transition-all cursor-pointer"
                >
                  <span>{unreadMessages} New {unreadMessages === 1 ? 'Message' : 'Messages'}</span>
                </Link>
              )}

              <span className="hidden md:inline-flex pill pill-live">
                <span className="pulse-dot">Open 24/7</span>
              </span>
              <FloorClock />
              <AdminThemeToggle />
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="hidden sm:inline-flex lg:hidden text-faint hover:text-stop transition-colors disabled:opacity-50 p-2 rounded-lg hover:bg-raised"
                aria-label="Sign out"
              >
                <Icon name="logout" size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* Centered Max-Width Main Body */}
        <main className="flex-1 w-full min-w-0">
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 2xl:px-12 py-6 sm:py-8 pb-24 lg:pb-12">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Quick-Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-panel/95 backdrop-blur-md border-t border-line-soft shadow-lg">
        <div className="flex items-center justify-around">
          {visibleNavItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href;
            const badgeCount =
              item.href === '/bookings'
                ? pendingPaymentsCount
                : item.hasBadge
                ? unreadMessages
                : 0;
            const showBadge = badgeCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[9.5px] sm:text-[10px] font-bold tracking-wider transition-colors ${
                  isActive ? 'text-brass' : 'text-faint hover:text-text'
                }`}
              >
                {isActive && <span className="absolute top-0 inset-x-3 h-[3px] bg-brass rounded-full" />}
                <div className="relative">
                  <Icon name={item.icon} size={17} />
                  {showBadge && (
                    <span className="absolute -top-1 -right-2 w-2.5 h-2.5 bg-stop rounded-full ring-2 ring-panel" />
                  )}
                </div>
                <span className="truncate max-w-full px-1">{item.label.split(' ')[0]}</span>
              </Link>
            );
          })}
          {/* Menu button to open drawer */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[9.5px] sm:text-[10px] font-bold tracking-wider text-faint hover:text-text"
          >
            <Icon name="menu" size={17} />
            <span className="truncate max-w-full px-1">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
