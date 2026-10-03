'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { uploadProfilePicture } from '@/lib/api';
import { Icon } from '@/components/Icon';

export default function ProfilePage() {
  const router = useRouter();
  const { customer, token, updateCustomer, isLoading, logout } = useCustomerAuth();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isLoading && !customer) {
      router.push('/login');
    }
  }, [customer, isLoading, router]);

  if (isLoading || !customer) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-mono text-brand-text-muted">Loading your profile…</p>
        </div>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 3MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target?.result as string;
      if (!base64 || !token) return;

      setPreviewUrl(base64);
      setUploading(true);
      try {
        const res = await uploadProfilePicture(base64, token);
        updateCustomer({ profilePictureUrl: res.profilePictureUrl });
        setSuccessMsg('Profile picture updated successfully!');
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to upload profile picture.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentAvatar = previewUrl || (customer.profilePictureUrl ? (
    customer.profilePictureUrl.startsWith('http')
      ? customer.profilePictureUrl
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${customer.profilePictureUrl}`
  ) : null);

  return (
    <div className="min-h-[70vh] zo-page-spacing zo-page-container">
      {/* Breadcrumb / Top Bar */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <Link
          href="/my-bookings"
          className="text-xs font-semibold text-brand-text-muted hover:text-brand-text-main flex items-center gap-1.5 transition-colors min-h-[44px] py-2"
        >
          <span>←</span>
          <span>View My Bookings</span>
        </Link>
        <button
          onClick={() => { void logout().catch(() => setErrorMsg('Sign out failed. Please retry.')); }}
          className="text-xs font-semibold text-brand-danger hover:underline cursor-pointer min-h-[44px] py-2 px-2 -mr-2"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-brand-surface border border-brand-border rounded-3xl zo-panel p-6 sm:p-10 space-y-8 shadow-sm">
        <div>
          <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight">
            Account Settings &amp; Profile
          </h1>
          <p className="text-xs sm:text-sm text-brand-text-muted mt-1">
            Manage your personal profile and display picture for bookings at ZeroOne.
          </p>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in flex items-center gap-2">
            <Icon name="check" size={14} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold animate-in fade-in flex items-center gap-2">
            <Icon name="alert" size={14} className="text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Avatar Upload Section */}
        <div className="p-6 rounded-2xl bg-brand-surface-raised border border-brand-border flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            {currentAvatar ? (
              <img
                src={currentAvatar}
                alt={customer.name}
                className="w-24 h-24 rounded-full object-cover border-2 border-brand-primary shadow-sm"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-3xl shadow-sm">
                {customer.name.charAt(0).toUpperCase()}
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div className="space-y-2 text-center sm:text-left flex-1">
            <h3 className="text-sm font-bold text-brand-text-main">Profile Photo</h3>
            <p className="text-xs text-brand-text-muted leading-relaxed">
              Upload a clear photo. Supported formats: JPG, PNG, WebP (Max 3MB).
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="zo-action px-4 py-2 min-h-[44px] rounded-xl text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload Photo'}
              </button>
            </div>
          </div>
        </div>

        {/* Customer Details Form / View */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-text-muted">Full Name</label>
            <div className="p-3.5 rounded-xl bg-brand-surface-subtle border border-brand-border text-sm font-bold text-brand-text-main">
              {customer.name}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-text-muted">Phone Number (Login ID)</label>
            <div className="p-3.5 rounded-xl bg-brand-surface-subtle border border-brand-border text-sm font-mono font-bold text-brand-text-main">
              {customer.phone}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-text-muted">Email Address</label>
            <div className="p-3.5 rounded-xl bg-brand-surface-subtle border border-brand-border text-sm text-brand-text-main">
              {customer.email || 'Not provided'}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-text-muted">Account Status</label>
            <div className="p-3.5 rounded-xl bg-brand-surface-subtle border border-brand-border text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-emerald-400">Verified Customer</span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="border-t border-brand-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/my-bookings"
            className="text-xs font-bold text-brand-primary hover:underline flex items-center justify-center gap-1 min-h-[44px] py-2"
          >
            <span>Go to My Bookings &amp; Passes</span>
            <span>→</span>
          </Link>
          <Link
            href="/book"
            className="zo-action px-5 py-2 min-h-[44px] flex items-center justify-center rounded-full text-xs font-bold text-white bg-brand-primary hover:bg-brand-primary-hover transition-colors w-full sm:w-auto"
          >
            Book a Session
          </Link>
        </div>
      </div>
    </div>
  );
}

