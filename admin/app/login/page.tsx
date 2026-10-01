'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Icon } from '@/components/Icon';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [newDeviceAlert, setNewDeviceAlert] = useState<{
    deviceInfo: any;
    whatsappAlertUrl?: string;
  } | null>(null);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.isNewDevice && data.user?.role === 'SUPER_ADMIN') {
        // If it's a new device for a Super Admin, show security modal before proceeding
        setNewDeviceAlert({
          deviceInfo: data.deviceInfo,
          whatsappAlertUrl: data.whatsappAlertUrl,
        });
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  function proceedToDashboard() {
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-ink">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="inline-block bg-[#0b1b17] border border-[#1c4b42]/40 rounded-2xl px-7 py-4 shadow-lg">
            <Image
              src="/logo.png"
              alt="ZEROONE Cue & Play"
              width={220}
              height={75}
              className="h-11 w-auto object-contain drop-shadow-[0_0_12px_rgba(212,169,79,0.25)] mx-auto"
              priority
            />
          </div>
          <p className="eyebrow text-center mt-3 tracking-widest text-[10px]">Operations & Management Console</p>
        </div>

        {newDeviceAlert ? (
          <div className="panel p-7 border-amber-500/40 bg-panel shadow-2xl space-y-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Icon name="shield" size={24} />
            </div>
            <div className="text-center">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
                New Device Security Alert
              </span>
              <h2 className="text-lg font-bold text-text">Unrecognized Login Detected</h2>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                We noticed a login to your Super Admin account from a new browser or IP address. An automated email security notification has been dispatched.
              </p>
            </div>

            <div className="bg-raised border border-line rounded-xl p-3.5 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-muted">Browser:</span>
                <span className="text-text font-bold">{newDeviceAlert.deviceInfo?.browser || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Operating System:</span>
                <span className="text-text font-bold">{newDeviceAlert.deviceInfo?.os || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">IP Address:</span>
                <span className="text-text font-bold">{newDeviceAlert.deviceInfo?.ipAddress || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Location:</span>
                <span className="text-emerald-400 font-bold">{newDeviceAlert.deviceInfo?.location || 'Unknown'}</span>
              </div>
            </div>

            {newDeviceAlert.whatsappAlertUrl && (
              <a
                href={newDeviceAlert.whatsappAlertUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all"
              >
                <Icon name="user" size={15} />
                <span>Send WhatsApp Security Backup</span>
              </a>
            )}

            <button
              onClick={proceedToDashboard}
              className="w-full py-3 rounded-xl bg-brass hover:bg-brass-bright text-ink font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              I Understand — Proceed to Dashboard
            </button>
          </div>
        ) : (
          <div className="panel p-7">
            <h1 className="display text-[22px] text-text">Staff sign in</h1>
            <p className="text-[12px] text-muted mt-1.5">
              Floor operations, reservations and payment approvals.
            </p>

            <form onSubmit={handleLogin} className="mt-7 space-y-4">
              <div>
                <label htmlFor="username" className="field-label">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="field"
                  placeholder="admin"
                />
              </div>

              <div>
                <label htmlFor="password" className="field-label">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="field"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5">
                  <Icon name="alert" size={14} className="mt-px" />
                  <span>{error}</span>
                </p>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary w-full py-3">
                {loading ? <span className="spinner" /> : <Icon name="lock" size={15} />}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>
        )}

        <p className="eyebrow text-center mt-5">Authorised staff only</p>
      </div>
    </div>
  );
}
