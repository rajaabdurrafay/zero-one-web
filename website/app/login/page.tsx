'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { customerLogin } from '@/lib/api';
import { isValidPakistaniPhone } from '@/lib/validation';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useCustomerAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ phone: false, password: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPhoneValid = !phone.trim() ? false : isValidPakistaniPhone(phone);
  const isPasswordValid = password.length > 0;
  const isFormValid = isPhoneValid && isPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ phone: true, password: true });
    setError(null);

    if (!isFormValid) return;

    setLoading(true);

    try {
      const res = await customerLogin({ phone: phone.trim(), password });
      login(res.token, res.customer);
      router.push('/my-bookings');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 pb-16 pt-24 sm:pt-28">
      <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-3 mb-8 relative">
          <Link href="/" className="inline-block group mb-2">
            <Image
              src="/logo-dark.png"
              alt="ZEROONE Cue & Play"
              width={200}
              height={70}
              className="h-11 w-auto object-contain mx-auto transition-transform duration-300 group-hover:scale-105 block dark:hidden"
            />
            <Image
              src="/logo.png"
              alt="ZEROONE Cue & Play"
              width={200}
              height={70}
              className="h-11 w-auto object-contain mx-auto transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_0_15px_rgba(255,255,255,0.15)] hidden dark:block"
            />
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight font-display uppercase">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted">
            Sign in to view and manage your club reservations
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
              Mobile Number *
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
                <span>Please enter a valid Pakistani mobile number (e.g. 0300 1234567)</span>
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider">
                Password *
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-accent hover:text-brand-primary font-semibold py-2"
              >
                Forgot Password?
              </Link>
            </div>
            <input
              type="password"
              required
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
                <span>Password is required</span>
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
                <span>Signing In...</span>
              </>
            ) : (
              <span>Sign In â†’</span>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-brand-border text-center text-xs text-brand-text-muted space-y-2 relative">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-brand-primary font-bold hover:underline">
              Create one now
            </Link>
          </p>
          <p>
            Need help or facing issues with your login? Reach us directly on{' '}
            <Link href="/contact" className="text-brand-accent hover:underline">
              Contact Support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

