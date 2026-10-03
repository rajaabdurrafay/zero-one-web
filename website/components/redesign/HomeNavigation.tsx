'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useSystemSettings } from '@/components/SystemStatusProvider';
import { PillLink } from './ui';

const links = [
  ['Home', '/'],
  ['Activities', '/activities'],
  ['About', '/about'],
  ['Gallery', '/gallery'],
  ['Reviews', '/reviews'],
  ['Location', '/location'],
  ['Contact', '/contact'],
];

export function HomeNavigation() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const { customer, logout } = useCustomerAuth();
  const { settings } = useSystemSettings();
  const signOut = async () => {
    try {
      await logout();
      setError('');
      dialog.current?.close();
    } catch {
      setError('Sign out failed. Please retry.');
    }
  };
  return (
    <header className="zo-navigation">
      <a href="#main-content" className="zo-skip-link">
        Skip to content
      </a>
      <nav
        className="zo-nav-inner zo-container glass-nav"
        aria-label="Main navigation"
        style={{
          backdropFilter: 'blur(var(--theme-glass-nav-blur, 0px))',
          WebkitBackdropFilter: 'blur(var(--theme-glass-nav-blur, 0px))',
        }}
      >
        <Link prefetch={false} href="/" className="zo-nav-logo" aria-label="ZeroOne home">
          <BrandLogo width={116} height={34} />
        </Link>
        <div className="zo-nav-links">
          {links.map(([label, href]) => (
            <Link
              prefetch={false}
              key={href}
              href={href}
              aria-current={href === '/' ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="zo-nav-actions">
          <div className="zo-desktop-theme">
            <ThemeToggle className="!w-11 !h-11" />
          </div>
          <PillLink
            href="/book"
            ariaLabel={settings?.bookingsEnabled === false ? 'Bookings Paused' : undefined}
          >
            {settings?.bookingsEnabled === false ? (
              <>
                <span className="zo-book-label-long">Bookings Paused</span>
                <span className="zo-book-label-short">Paused</span>
              </>
            ) : (
              'Book Now'
            )}
          </PillLink>
          <div className="zo-nav-account">
            {customer ? (
              <details className="zo-account-menu">
                <summary>Account</summary>
                <div>
                  <Link prefetch={false} href="/profile">
                    My Profile
                  </Link>
                  <Link prefetch={false} href="/my-bookings">
                    My Bookings
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void signOut();
                    }}
                  >
                    Sign Out
                  </button>
                  {error && <p role="alert">{error}</p>}
                </div>
              </details>
            ) : (
              <Link prefetch={false} href="/login">
                Sign In
              </Link>
            )}
          </div>
          <button
            type="button"
            className="zo-menu-trigger"
            aria-label="Open navigation"
            aria-expanded={open}
            aria-controls="zo-mobile-navigation"
            onClick={() => {
              dialog.current?.showModal();
              setOpen(true);
            }}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>
      <dialog
        ref={dialog}
        id="zo-mobile-navigation"
        className="zo-mobile-nav"
        onClose={() => setOpen(false)}
        aria-labelledby="zo-mobile-nav-title"
      >
        <div className="zo-mobile-nav-heading">
          <span id="zo-mobile-nav-title">Explore ZeroOne</span>
          <button
            type="button"
            aria-label="Close navigation"
            aria-expanded={open}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          {links.map(([label, href]) => (
            <Link prefetch={false} key={href} href={href} onClick={() => dialog.current?.close()}>
              {label}
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </nav>
        <div className="zo-mobile-nav-bottom">
          <ThemeToggle className="!w-11 !h-11" />
          <span>Light / dark appearance</span>
        </div>
        {customer ? (
          <>
            <Link prefetch={false} href="/my-bookings" onClick={() => dialog.current?.close()}>
              My Bookings
            </Link>
            <Link prefetch={false} href="/profile" onClick={() => dialog.current?.close()}>
              My Profile
            </Link>
            <button
              type="button"
              className="zo-nav-signout"
              onClick={() => {
                void signOut();
              }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <div className="zo-mobile-auth">
            <Link prefetch={false} href="/login">
              Sign In
            </Link>
            <Link prefetch={false} href="/signup">
              Create Account
            </Link>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </dialog>
    </header>
  );
}
