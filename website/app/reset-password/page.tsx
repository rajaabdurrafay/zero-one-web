'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { resetPassword } from '@/lib/api';
import { Icon } from '@/components/Icon';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing password reset token. Please request a new link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <h1 className="zo-inner-title">Reset your password</h1>
        <div className="p-4 rounded-xl bg-brand-danger/20 border border-brand-danger/40 text-brand-text-main text-sm">
          No password reset token provided.
        </div>
        <Link
          href="/forgot-password"
          className="inline-block text-brand-primary font-bold hover:underline text-sm"
        >
          Request a New Reset Link →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center space-y-3 mb-8 relative">
          <Link href="/" className="inline-block group mb-2">
            <BrandLogo width={160} height={56} className="h-10 w-auto object-contain" />
          </Link>
          <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight font-display uppercase">
            Reset Password
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted">
            Enter your new password below to regain access to your account.
          </p>
        </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-brand-danger/20 border border-brand-danger/40 text-brand-text-main text-xs sm:text-sm flex items-start gap-2.5">
          <Icon name="alert" size={16} className="text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {success ? (
        <div className="space-y-6 text-center">
          <div className="p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-sm leading-relaxed">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto mb-2.5">
              <Icon name="check" size={20} />
            </div>
            <p className="font-semibold text-brand-text-main mb-1">Password Changed Successfully!</p>
            <p className="text-xs text-emerald-300">
              Your password has been updated. Redirecting you to login...
            </p>
          </div>

          <Link
            href="/login"
            className="zo-action inline-block w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-lg shadow-brand-primary/30 transition-all text-center"
          >
            Go to Login Now →
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 relative">
          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              New Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-sm placeholder:text-brand-text-muted/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-sm placeholder:text-brand-text-muted/50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="zo-action w-full mt-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-50 shadow-lg shadow-brand-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Updating Password...</span>
              </>
            ) : (
              <span>Reset Password →</span>
            )}
          </button>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-brand-border text-center text-xs text-brand-text-muted relative">
        <Link href="/login" className="text-brand-primary font-bold hover:underline">
          ← Back to Login
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 zo-page-spacing">
      <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl zo-panel p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        <Suspense fallback={<div className="text-center text-brand-text-muted py-10">Loading reset token...</div>}>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  );
}

