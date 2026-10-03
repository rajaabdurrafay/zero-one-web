'use client';

import { PageIntro } from '@/components/redesign/PageIntro';
import { useState } from 'react';
import Link from 'next/link';
import { isValidEmail, isValidPakistaniPhone } from '@/lib/validation';
import { Icon } from '@/components/Icon';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  });
  const [touched, setTouched] = useState({
    name: false,
    phone: false,
    email: false,
    message: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const phone = '0371-2160471';
  const email = 'info@cueandplay.pk';
  const address = 'F-1, Mezzanine Floor, Block-3A Kamran Chowrangi, Gulistan-e-Jauhar, Karachi';

  const isNameValid = formData.name.trim().length > 0;
  const isPhoneValid = !formData.phone.trim() ? false : isValidPakistaniPhone(formData.phone);
  const isEmailValid = !formData.email.trim() ? true : isValidEmail(formData.email);
  const isMessageValid = formData.message.trim().length > 0;
  const isFormValid = isNameValid && isPhoneValid && isEmailValid && isMessageValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, message: true });
    setErrorMessage('');

    if (!isFormValid) return;

    setLoading(true);
    setSubmitted(false);

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          subject: formData.subject.trim(),
          message: formData.message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send your message. Please try again.');
      }

      setSubmitted(true);
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: 'General Inquiry',
        message: '',
      });
      setTouched({
        name: false,
        phone: false,
        email: false,
        message: false,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Something went wrong. Please try again or chat with us on WhatsApp.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 zo-page-spacing">
      {/* Header */}
      <PageIntro label="Contact" title="Let’s connect." description="Planning a game night or need a hand with your booking? Reach out to the ZeroOne team." image="/images/Cinema/cinema.jpg.webp" />

      {/* Main Grid: Form + Quick Contact Cards */}
      <section className="zo-page-container">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: Direct Contact Channels (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-brand-surface rounded-3xl zo-panel border border-brand-border p-6 sm:p-8 space-y-6">
              <h2 className="text-xl font-black text-brand-text-main">Direct Channels</h2>

              <div className="space-y-4 text-sm">
                {/* WhatsApp */}
                <a
                  href={`https://wa.me/${phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl bg-brand-bg border border-brand-border hover:border-emerald-500/50 transition-all flex items-center gap-4 group block"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon name="message" size={22} />
                  </div>
                  <div>
                    <span className="text-xs text-brand-text-muted font-semibold block">Instant Support</span>
                    <span className="text-brand-text-main font-black text-base group-hover:text-emerald-400 transition-colors">
                      WhatsApp Chat
                    </span>
                    <span className="text-xs text-brand-primary block font-mono mt-0.5">{phone}</span>
                  </div>
                </a>

                {/* Phone Call */}
                <a
                  href={`tel:${phone}`}
                  className="p-4 rounded-2xl bg-brand-bg border border-brand-border hover:border-brand-primary/50 transition-all flex items-center gap-4 group block"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-primary/10 border border-brand-primary/30 text-brand-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon name="phone" size={22} />
                  </div>
                  <div>
                    <span className="text-xs text-brand-text-muted font-semibold block">Direct Counter</span>
                    <span className="text-brand-text-main font-black text-base group-hover:text-brand-primary transition-colors">
                      Call Front Desk
                    </span>
                    <span className="text-xs text-brand-primary block font-mono mt-0.5">{phone}</span>
                  </div>
                </a>

                {/* Email */}
                <a
                  href={`mailto:${email}`}
                  className="p-4 rounded-2xl bg-brand-bg border border-brand-border hover:border-brand-accent/50 transition-all flex items-center gap-4 group block"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-accent/10 border border-brand-accent/30 text-brand-accent flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Icon name="message" size={22} />
                  </div>
                  <div>
                    <span className="text-xs text-brand-text-muted font-semibold block">Management Email</span>
                    <span className="text-brand-text-main font-black text-base group-hover:text-brand-accent transition-colors truncate block">
                      {email}
                    </span>
                    <span className="text-xs text-brand-text-muted block mt-0.5">Response within 24h</span>
                  </div>
                </a>

                {/* Physical Location */}
                <div className="p-4 rounded-2xl bg-brand-bg border border-brand-border flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="target" size={22} />
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-brand-text-muted font-semibold block">Arena Address</span>
                    <span className="text-brand-text-main font-bold text-sm block leading-snug">
                      {address}
                    </span>
                    <Link
                      href="/location"
                      className="text-xs text-brand-primary hover:underline font-semibold inline-flex items-center gap-1 mt-1"
                    >
                      <span>View on Interactive Map</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Contact Form (lg:col-span-7) */}
          <div className="lg:col-span-7">
            <div className="bg-brand-surface rounded-3xl zo-panel border border-brand-border p-6 sm:p-10 space-y-6 shadow-2xl">
              <div>
                <h2 className="text-2xl font-black text-brand-text-main">Send Us A Message</h2>
                <p className="text-xs sm:text-sm text-brand-text-muted mt-1">
                  Fill in the details below and our management will get back to you promptly.
                </p>
              </div>

              {submitted && (
                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-3 animate-in fade-in">
                  <Icon name="check" size={20} className="text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block font-bold">Message sent! We&apos;ll get back to you soon.</strong>
                    <span>Your inquiry has been received by our operations team.</span>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 text-red-300 text-sm flex items-center gap-3 animate-in fade-in">
                  <Icon name="alert" size={20} className="text-rose-400 shrink-0" />
                  <div>
                    <strong className="block font-bold">Error sending message</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      placeholder="e.g. Hammad Ali"
                      className={`w-full px-4 py-3 rounded-xl bg-brand-bg border text-brand-text-main text-sm focus:outline-none transition-colors ${
                        touched.name && !isNameValid
                          ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                          : 'border-brand-border focus:border-brand-primary'
                      }`}
                    />
                    {touched.name && !isNameValid && (
                      <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                        <Icon name="alert" size={12} className="text-rose-400" />
                        <span>Name is required</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                      placeholder="0300 1234567"
                      className={`w-full px-4 py-3 rounded-xl bg-brand-bg border text-brand-text-main text-sm focus:outline-none transition-colors ${
                        touched.phone && !isPhoneValid
                          ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                          : 'border-brand-border focus:border-brand-primary'
                      }`}
                    />
                    {touched.phone && !isPhoneValid && (
                      <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                        <Icon name="alert" size={12} className="text-rose-400" />
                        <span>Enter a valid Pakistani mobile number (e.g. 0300 1234567)</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-brand-text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      placeholder="you@example.com"
                      className={`w-full px-4 py-3 rounded-xl bg-brand-bg border text-brand-text-main text-sm focus:outline-none transition-colors ${
                        touched.email && !isEmailValid
                          ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                          : 'border-brand-border focus:border-brand-primary'
                      }`}
                    />
                    {touched.email && !isEmailValid && (
                      <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                        <Icon name="alert" size={12} className="text-rose-400" />
                        <span>Enter a valid email address</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="contact-subject" className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">
                      Subject
                    </label>
                    <select id="contact-subject" aria-label="Subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="zo-select w-full px-4 py-3 rounded-xl bg-brand-bg border border-brand-border text-brand-text-main text-sm focus:outline-none focus:border-brand-primary transition-colors"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Private Cinema Booking">Private Cinema Booking</option>
                      <option value="Tournament / Squad Event">Tournament / Squad Event</option>
                      <option value="Snooker Table Reservation">Snooker Table Reservation</option>
                      <option value="Feedback / Suggestion">Feedback / Suggestion</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-1.5">
                    Your Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    onBlur={() => setTouched((t) => ({ ...t, message: true }))}
                    placeholder="Tell us what you need or ask any questions..."
                    className={`w-full p-4 rounded-xl bg-brand-bg border text-brand-text-main text-sm focus:outline-none transition-colors ${
                      touched.message && !isMessageValid
                        ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                        : 'border-brand-border focus:border-brand-primary'
                    }`}
                  />
                  {touched.message && !isMessageValid && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <Icon name="alert" size={12} className="text-rose-400" />
                      <span>Message cannot be empty</span>
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className="zo-action w-full py-4 rounded-xl text-sm font-black text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-lg shadow-brand-primary/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? (
                    <span>Sending message...</span>
                  ) : (
                    <>
                      <span>Send Message</span>
                      <Icon name="sparkles" size={14} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

