'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useSystemSettings } from '@/components/SystemStatusProvider';
import { cn } from '@/lib/cn';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BrandLogo } from '@/components/BrandLogo';
import { HomeNavigation } from '@/components/redesign/HomeNavigation';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { customer, logout } = useCustomerAuth();
  const { settings: systemSettings } = useSystemSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/activities', label: 'Activities' },
    { href: '/about', label: 'About' },
    { href: '/gallery', label: 'Gallery' },
    { href: '/reviews', label: 'Reviews' },
    { href: '/location', label: 'Location' },
    { href: '/contact', label: 'Contact' },
  ];

  const handleLogout = async () => {
    try { await logout(); router.push('/'); }
    catch { window.alert('Sign out failed. Please retry.'); }
  };

  if (pathname === '/') return <HomeNavigation />;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
      <div className="max-w-[1400px] mx-auto">
        <nav
          className={cn(
            'glass-nav flex items-center justify-between px-5 sm:px-7 py-3 rounded-full transition-all duration-300 border',
            isScrolled
              ? 'bg-brand-surface/90 backdrop-blur-md border-brand-border shadow-xs'
              : 'bg-brand-surface/75 backdrop-blur-sm border-brand-border/60'
          )}
        >
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <BrandLogo
              width={140}
              height={40}
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              priority
            />
          </Link>

          {/* Center Links */}
          <div className="hidden md:flex items-center gap-1.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all',
                    isActive
                      ? 'text-brand-text-main bg-brand-surface-raised font-bold'
                      : 'text-brand-text-muted hover:text-brand-text-main hover:bg-brand-surface-raised/60'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {customer ? (
              <div className="hidden sm:flex items-center gap-2.5">
                <Link
                  href="/profile"
                  className={cn(
                    'flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full text-xs font-semibold border transition-all',
                    pathname === '/profile' || pathname === '/my-bookings'
                      ? 'bg-brand-surface-raised border-brand-primary/50 text-brand-text-main shadow-xs'
                      : 'bg-brand-surface border-brand-border text-brand-text-main hover:bg-brand-surface-raised'
                  )}
                >
                  {customer.profilePictureUrl ? (
                    <img
                      src={customer.profilePictureUrl.startsWith('http') ? customer.profilePictureUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${customer.profilePictureUrl}`}
                      alt={customer.name}
                      className="w-6 h-6 rounded-full object-cover border border-brand-border"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-brand-primary text-white flex items-center justify-center font-bold text-[10px]">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[100px] truncate">{customer.name.split(' ')[0]}</span>
                </Link>
                <Link
                  href="/my-bookings"
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    pathname === '/my-bookings'
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-brand-surface border-brand-border text-brand-text-muted hover:text-brand-text-main hover:bg-brand-surface-raised'
                  )}
                >
                  Bookings
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2 py-1 text-xs text-brand-text-muted hover:text-brand-danger font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-semibold text-brand-text-muted hover:text-brand-text-main transition-colors"
              >
                Sign In
              </Link>
            )}

            <ThemeToggle />

            {systemSettings && !systemSettings.bookingsEnabled ? (
              <Link
                href="/book"
                className="inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2 rounded-full text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 shadow-xs transition-all"
              >
                Bookings Paused
              </Link>
            ) : (
              <Link
                href="/book"
                className="inline-flex items-center justify-center px-5 py-2 sm:px-6 sm:py-2.5 rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-xs transition-all active:scale-[0.98]"
              >
                Book Now
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full border border-brand-border text-brand-text-muted hover:text-brand-text-main hover:bg-brand-surface-raised transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-2 p-4 rounded-3xl bg-brand-surface border border-brand-border shadow-lg space-y-2 animate-in fade-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-[85vh]">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'block px-4 py-3 min-h-[44px] flex items-center rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-surface-raised text-brand-text-main font-bold'
                      : 'text-brand-text-muted hover:bg-brand-surface-raised hover:text-brand-text-main'
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-3 mt-2 border-t border-brand-border flex flex-col gap-2">
              {customer ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-brand-surface-raised">
                    {customer.profilePictureUrl ? (
                      <img
                        src={customer.profilePictureUrl.startsWith('http') ? customer.profilePictureUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${customer.profilePictureUrl}`}
                        alt={customer.name}
                        className="w-9 h-9 rounded-full object-cover shrink-0 border border-brand-border"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand-surface-subtle text-brand-text-main flex items-center justify-center font-bold text-sm border border-brand-border shrink-0">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-brand-text-main truncate">{customer.name}</p>
                      <p className="text-[11px] font-mono text-brand-text-muted truncate">{customer.phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Link
                      href="/profile"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-brand-surface-subtle text-brand-text-main text-center border border-brand-border hover:bg-brand-surface-raised"
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/my-bookings"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-brand-surface-subtle text-brand-text-main text-center border border-brand-border hover:bg-brand-surface-raised"
                    >
                      My Bookings
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2 text-xs font-semibold text-brand-danger text-center"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    className="py-2.5 px-4 rounded-xl text-center text-xs font-semibold border border-brand-border text-brand-text-main"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="py-2.5 px-4 rounded-xl text-center text-xs font-semibold bg-brand-surface-raised text-brand-text-main"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
