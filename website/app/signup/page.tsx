'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { useRouter } from 'next/navigation';
import { customerSignup } from '@/lib/api';
import { isValidEmail, isValidPakistaniPhone } from '@/lib/validation';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { Icon } from '@/components/Icon';

export default function SignupPage() {
  const router = useRouter();
  const { login } = useCustomerAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ name: false, phone: false, email: false, password: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameValid = name.trim().length > 0;
  const isPhoneValid = !phone.trim() ? false : isValidPakistaniPhone(phone);
  const isEmailValid = !email.trim() ? true : isValidEmail(email);
  const isPasswordValid = password.length >= 8;
  const isFormValid = isNameValid && isPhoneValid && isEmailValid && isPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true, password: true });
    setError(null);

    if (!isFormValid) return;

    setLoading(true);

    try {
      const res = await customerSignup({
        name: name.trim(),
        phone: phone.trim(),
        password,
        email: email.trim() || undefined,
      });
      login(res.token, res.customer);
      router.push('/my-bookings');
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
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
            Create Customer Account
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted">
            Track reservations, re-upload payment proof & manage booking history
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-brand-danger/20 border border-brand-danger/40 text-brand-text-main text-xs sm:text-sm flex items-start gap-2.5">
            <Icon name="alert" size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ali Khan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              className={`w-full px-4 py-3 min-h-[44px] bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm placeholder:text-brand-text-muted/50 transition-colors ${
                touched.name && !isNameValid
                  ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                  : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
              }`}
            />
            {touched.name && !isNameValid && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <Icon name="alert" size={12} className="text-rose-400" />
                <span>Full name is required</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Mobile Number (WhatsApp) *
            </label>
            <input
              type="tel"
              required
              placeholder="0300 1234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              className={`w-full px-4 py-3 min-h-[44px] bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm placeholder:text-brand-text-muted/50 transition-colors ${
                touched.phone && !isPhoneValid
                  ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                  : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
              }`}
            />
            {touched.phone && !isPhoneValid && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <Icon name="alert" size={12} className="text-rose-400" />
                <span>Please enter a valid Pakistani mobile number (e.g. 0300 1234567 or +923001234567)</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Email Address <span className="text-brand-text-muted">(Optional)</span>
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className={`w-full px-4 py-3 min-h-[44px] bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm placeholder:text-brand-text-muted/50 transition-colors ${
                touched.email && !isEmailValid
                  ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                  : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
              }`}
            />
            {touched.email && !isEmailValid && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <Icon name="alert" size={12} className="text-rose-400" />
                <span>Please enter a valid email address (e.g. name@example.com)</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Set Password *
            </label>
            <input
              type="password"
              required
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              className={`w-full px-4 py-3 min-h-[44px] bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm placeholder:text-brand-text-muted/50 transition-colors ${
                touched.password && !isPasswordValid
                  ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                  : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
              }`}
            />
            {touched.password && !isPasswordValid && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1.5">
                <Icon name="alert" size={12} className="text-rose-400" />
                <span>Password must be at least 8 characters</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full mt-2 py-3.5 px-4 min-h-[44px] rounded-xl text-sm font-bold text-white bg-gradient-to-r from-brand-primary via-brand-primary-hover to-brand-accent hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account →</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-brand-border text-center text-xs text-brand-text-muted space-y-3">
          <p>
            Already have an account?{' '}
            <Link href="/login" className="text-brand-primary font-bold hover:underline">
              Sign In
            </Link>
          </p>
          <p>
            By creating an account, you agree to ZEROONE Cue & Play reservation rules and slot policies.
          </p>
        </div>
      </div>
    </div>
  );
}

