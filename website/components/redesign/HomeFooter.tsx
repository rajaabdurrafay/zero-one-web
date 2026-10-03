import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { PillLink } from './ui';

export function HomeFooter() {
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE || '0371-2160471';
  const address = process.env.NEXT_PUBLIC_LOCATION_ADDRESS || 'Gulistan-e-Jauhar, Karachi';
  const instagram = process.env.NEXT_PUBLIC_INSTAGRAM_URL || 'https://www.instagram.com/cueandplay.pk';
  const tiktok = process.env.NEXT_PUBLIC_TIKTOK_URL || 'https://www.tiktok.com/@cueandplay.pk';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const whatsapp = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
  return <footer className="zo-footer"><div className="zo-container">
    <div className="zo-footer-cta"><div><span className="zo-eyebrow">One more game?</span><h2>See you at ZeroOne.</h2></div><PillLink href="/book">Book Your Session</PillLink></div>
    <div className="zo-footer-grid"><div className="zo-footer-brand"><Link prefetch={false} href="/" aria-label="ZeroOne home"><BrandLogo width={150} height={45} forceMode="DARK" /></Link><p>Games, friendly rivalries and nights worth making time for.</p><address>{address}</address><a href={`tel:${phone.replace(/[^+0-9]/g, '')}`}>{phone}</a></div><div><h3>Explore</h3><Link prefetch={false} href="/activities">Our Activities</Link><Link prefetch={false} href="/about">About ZeroOne</Link><Link prefetch={false} href="/gallery">Gallery</Link><Link prefetch={false} href="/reviews">Player Reviews</Link></div><div><h3>Your Session</h3><Link prefetch={false} href="/book">Book Now</Link><Link prefetch={false} href="/my-bookings">My Bookings</Link><Link prefetch={false} href="/login">Sign In</Link><Link prefetch={false} href="/signup">Create Account</Link></div><div><h3>Let&apos;s Connect</h3><Link prefetch={false} href="/location">Find Us</Link><Link prefetch={false} href="/contact">Contact</Link><a href={instagram} target="_blank" rel="noopener noreferrer">Instagram ↗</a><a href={tiktok} target="_blank" rel="noopener noreferrer">TikTok ↗</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a></div></div>
    <div className="zo-footer-bottom"><span>© {new Date().getFullYear()} ZeroOne Cue &amp; Play</span><span>Gulistan-e-Jauhar · Karachi</span><Link prefetch={false} href="/contact">Questions? Get in touch ↗</Link></div>
  </div></footer>;
}
