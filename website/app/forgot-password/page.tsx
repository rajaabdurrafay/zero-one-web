'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { forgotPassword } from '@/lib/api';
import { isValidEmail } from '@/lib/validation';
import { Icon } from '@/components/Icon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmailValid = isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);

    if (!isEmailValid) return;

    setLoading(true);

    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reset request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 zo-page-spacing">
      <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl zo-panel p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-3 mb-8 relative">
          <Link href="/" className="inline-block group mb-2">
            <BrandLogo width={160} height={56} className="h-10 w-auto object-contain" />
          </Link>
          <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight font-display uppercase">
            Forgot Password
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted">
            Enter your registered email address to receive a secure password reset link.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-brand-danger/20 border border-brand-danger/40 text-brand-text-main text-xs sm:text-sm flex items-start gap-2.5">
            <Icon name="alert" size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {submitted ? (
          <div className="space-y-6 text-center">
            <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm leading-relaxed">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2.5">
                <Icon name="message" size={20} />
              </div>
              <p className="font-semibold text-brand-text-main mb-1">Check Your Email</p>
              <p className="text-xs text-emerald-300">
                If an account exists with <strong className="text-brand-text-main">{email}</strong>, we have sent instructions to reset your password. The link expires in 1 hour.
              </p>
            </div>

            <Link
              href="/login"
              className="zo-action inline-block w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-lg shadow-brand-primary/30 transition-all text-center"
            >
              Return to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative">
            <div>
              <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm placeholder:text-brand-text-muted/50 transition-colors ${
                  touched && !isEmailValid
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                    : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
                }`}
              />
              {touched && !isEmailValid && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                  <Icon name="alert" size={12} className="text-rose-400" />
                  <span>Please enter a valid email address (e.g. name@example.com)</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isEmailValid}
              className="zo-action w-full mt-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Sending Link...</span>
                </>
              ) : (
                <span>Send Reset Link →</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-brand-border text-center text-xs text-brand-text-muted relative">
          <Link href="/login" className="text-brand-primary font-bold hover:underline">
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

