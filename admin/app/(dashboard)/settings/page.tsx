'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';
import { PageContainer } from '@/components/Card';
import {
  getAdminSystemSettings,
  updateAdminSystemSettings,
  clearSystemCache,
  downloadFullBackup,
  exportCustomersCsv,
  getAdminLoginSessions,
  revokeAdminLoginSession,
  type SystemSettings,
  type AdminLoginSession,
} from '@/lib/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Cache clearing state
  const [clearingCache, setClearingCache] = useState(false);
  const [cacheSuccessMessage, setCacheSuccessMessage] = useState('');
  const [cacheErrorMessage, setCacheErrorMessage] = useState('');

  // Backup state
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [exportingCustomers, setExportingCustomers] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);

  // Login Sessions State (New Device Tracking)
  const [loginSessions, setLoginSessions] = useState<AdminLoginSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Form State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [bookingsEnabled, setBookingsEnabled] = useState(true);
  const [bookingsPausedMessage, setBookingsPausedMessage] = useState('');
  const [emergencyClosedToday, setEmergencyClosedToday] = useState(false);
  const [emergencyClosedMessage, setEmergencyClosedMessage] = useState('');
  const [walkInsEnabled, setWalkInsEnabled] = useState(true);
  const [contactPhone, setContactPhone] = useState('');



  async function fetchLoginSessions() {
    setLoadingSessions(true);
    try {
      const data = await getAdminLoginSessions();
      setLoginSessions(data);
    } catch {
      // Ignored if user is not Super Admin
    } finally {
      setLoadingSessions(false);
    }
  }


  async function fetchSettings() {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await getAdminSystemSettings();
      setSettings(data);
      setMaintenanceMode(data.maintenanceMode);
      setMaintenanceMessage(data.maintenanceMessage || 'We are currently undergoing scheduled maintenance. We will be back online shortly!');
      setBookingsEnabled(data.bookingsEnabled);
      setBookingsPausedMessage(data.bookingsPausedMessage || 'Online bookings are temporarily paused. Please call or visit us directly to book your slot.');
      setEmergencyClosedToday(data.emergencyClosedToday);
      setEmergencyClosedMessage(data.emergencyClosedMessage || 'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.');
      setWalkInsEnabled(data.walkInsEnabled);
      setContactPhone(data.contactPhone || '+92 300 1234567');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
    fetchLoginSessions();
    try {
      const savedDate = localStorage.getItem('__zeroone_last_backup_date');
      if (savedDate) setLastBackupDate(savedDate);
    } catch { /* ignore */ }
  }, []);

  async function handleRevokeSession(sessionId: string) {
    if (!confirm('Revoke this device? If this device signs in again, a new login alert will be triggered.')) {
      return;
    }
    try {
      await revokeAdminLoginSession(sessionId);
      toast.success('Device session revoked successfully');
      setLoginSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke device session');
    }
  }

  async function handleSave() {
    setSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const res = await updateAdminSystemSettings({
        maintenanceMode,
        maintenanceMessage,
        bookingsEnabled,
        bookingsPausedMessage,
        emergencyClosedToday,
        emergencyClosedMessage,
        walkInsEnabled,
        contactPhone,
      });

      setSettings(res.settings);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update system settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCache() {
    setClearingCache(true);
    setCacheSuccessMessage('');
    setCacheErrorMessage('');

    try {
      const res = await clearSystemCache();
      setCacheSuccessMessage(res.message || 'Cache cleared! Changes will now appear immediately.');
      setTimeout(() => setCacheSuccessMessage(''), 5000);
    } catch (err: any) {
      setCacheErrorMessage(err.message || 'Failed to clear system cache');
      setTimeout(() => setCacheErrorMessage(''), 5000);
    } finally {
      setClearingCache(false);
    }
  }

  async function handleDownloadBackup() {
    setDownloadingBackup(true);
    try {
      const blob = await downloadFullBackup();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zeroone-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      const now = new Date().toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
      setLastBackupDate(now);
      localStorage.setItem('__zeroone_last_backup_date', now);
      toast.success('Business data export downloaded successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to download backup');
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function handleExportCustomers() {
    setExportingCustomers(true);
    try {
      const blob = await exportCustomersCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Customers exported to CSV');
    } catch (err: any) {
      toast.error(err.message || 'Failed to export customers');
    } finally {
      setExportingCustomers(false);
    }
  }

  return (
    <PageContainer className="pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">System & Operations Settings</h1>
            <span className="inline-flex items-center text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-brass/15 text-brass border border-brass/30">
              Super Admin Only
            </span>
          </div>
          <p className="text-sm text-muted mt-1">
            Global controls for public website availability, online booking toggles, emergency closure, and walk-in policies.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brass hover:bg-brass-bright text-ink font-bold text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer shrink-0"
        >
          {saving ? (
            <>
              <Icon name="refresh" size={16} className="animate-spin" />
              <span>Saving Changes…</span>
            </>
          ) : (
            <>
              <Icon name="check" size={16} />
              <span>Save System Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-3 text-sm animate-in fade-in">
          <Icon name="check" size={18} />
          <span>System settings updated successfully! Live website behavior has been refreshed.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-3 text-sm">
          <Icon name="alert" size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted">
          <Icon name="refresh" size={28} className="animate-spin mx-auto mb-3 text-brass" />
          <p className="text-sm font-medium">Loading system settings…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Quick Overview Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className={`p-4 rounded-2xl border transition-all ${
              maintenanceMode
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                : 'bg-panel border-line-soft text-text'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted">Website Status</span>
                <span className={`w-2.5 h-2.5 rounded-full ${maintenanceMode ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
              </div>
              <p className="text-lg font-bold mt-1">
                {maintenanceMode ? 'Under Maintenance' : 'Live & Active'}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {maintenanceMode ? 'Public visitors see maintenance page' : 'Website is accessible to public'}
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${
              !bookingsEnabled
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'bg-panel border-line-soft text-text'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted">Online Bookings</span>
                <span className={`w-2.5 h-2.5 rounded-full ${bookingsEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              </div>
              <p className="text-lg font-bold mt-1">
                {bookingsEnabled ? 'Accepting Bookings' : 'Bookings Paused'}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {bookingsEnabled ? 'Customers can book slots online' : 'Website booking disabled; direct call only'}
              </p>
            </div>

            <div className={`p-4 rounded-2xl border transition-all ${
              emergencyClosedToday
                ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                : 'bg-panel border-line-soft text-text'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-muted">Today&#39;s Venue Status</span>
                <span className={`w-2.5 h-2.5 rounded-full ${emergencyClosedToday ? 'bg-rose-500' : 'bg-emerald-500'}`} />
              </div>
              <p className="text-lg font-bold mt-1">
                {emergencyClosedToday ? 'Closed Today' : 'Open for Business'}
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                {emergencyClosedToday ? 'Emergency closure banner active' : 'Normal operating hours'}
              </p>
            </div>
          </div>

          {/* SECTION 1: MAINTENANCE MODE */}
          <div className={`p-6 rounded-2xl border transition-all ${
            maintenanceMode ? 'bg-panel border-rose-500/40 shadow-lg shadow-rose-950/20' : 'bg-panel border-line-soft'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line-soft">
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  maintenanceMode ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-subtle text-muted border border-line-soft'
                }`}>
                  <Icon name="power" size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text flex items-center gap-2">
                    Maintenance Mode (Public Website)
                    {maintenanceMode && (
                      <span className="text-[10.5px] px-2 py-0.5 font-bold uppercase rounded-full bg-rose-500 text-white">
                        ACTIVE
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-2xl">
                    When enabled, the public website will show an elegant &quot;Under Maintenance&quot; page to all visitors.
                    <strong className="text-text"> The Admin Panel remains 100% accessible</strong> for staff and administrators at all times.
                  </p>
                </div>
              </div>

              {/* Big Switch Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={maintenanceMode}
                  onChange={(e) => setMaintenanceMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-600 shadow-inner"></div>
              </label>
            </div>

            {/* Custom Maintenance Message */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-semibold text-text uppercase tracking-wider block">
                Custom Maintenance Message Shown to Visitors
              </label>
              <textarea
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
                placeholder="We are currently undergoing scheduled maintenance. We will be back online shortly!"
                className="w-full px-4 py-3 bg-subtle border border-line rounded-xl text-sm text-text placeholder:text-faint focus:outline-none focus:border-brass transition-all"
              />
              <p className="text-[11px] text-faint">
                Tip: Mention expected completion time or provide an emergency contact number if needed.
              </p>
            </div>
          </div>

          {/* SECTION 2: ONLINE BOOKINGS CONTROL */}
          <div className={`p-6 rounded-2xl border transition-all ${
            !bookingsEnabled ? 'bg-panel border-amber-500/40 shadow-lg shadow-amber-950/20' : 'bg-panel border-line-soft'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line-soft">
              <div className="flex items-start gap-3.5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  bookingsEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  <Icon name="calendar" size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text flex items-center gap-2">
                    Online Bookings Status
                    {!bookingsEnabled ? (
                      <span className="text-[10.5px] px-2 py-0.5 font-bold uppercase rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        PAUSED
                      </span>
                    ) : (
                      <span className="text-[10.5px] px-2 py-0.5 font-bold uppercase rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        ENABLED
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted mt-1 leading-relaxed max-w-2xl">
                    When paused, customers can still browse the public website, check pricing, and view gallery, but online slot booking forms will be disabled.
                    <strong className="text-text"> Walk-in bookings from the Admin Panel still work normally.</strong>
                  </p>
                </div>
              </div>

              {/* Big Switch Toggle */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={bookingsEnabled}
                  onChange={(e) => setBookingsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-14 h-8 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600 shadow-inner"></div>
              </label>
            </div>

            {/* Custom Paused Message */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-semibold text-text uppercase tracking-wider block">
                Message Displayed on Booking Pages When Paused
              </label>
              <textarea
                value={bookingsPausedMessage}
                onChange={(e) => setBookingsPausedMessage(e.target.value)}
                rows={2}
                placeholder="Online bookings are temporarily paused. Please call or visit us directly to book your slot."
                className="w-full px-4 py-3 bg-subtle border border-line rounded-xl text-sm text-text placeholder:text-faint focus:outline-none focus:border-brass transition-all"
              />
            </div>
          </div>

          {/* SECTION 3: EMERGENCY VENUE CLOSURE & LOCKDOWN (EXTRA USEFUL CONTROLS) */}
          <div className="p-6 rounded-2xl bg-panel border border-line-soft space-y-5">
            <div>
              <h2 className="text-base font-bold text-text flex items-center gap-2">
                <Icon name="shield" size={18} className="text-brass" />
                Additional Operational Safeguards
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Quick emergency switches for special circumstances like private VIP events, power outages, or holidays.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Emergency Closed Today */}
              <div className={`p-4 rounded-xl border transition-all ${
                emergencyClosedToday ? 'bg-rose-500/10 border-rose-500/30' : 'bg-subtle/50 border-line-soft'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-text">Emergency Closed Today</h3>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      Temporarily marks today&#39;s availability as unavailable without deleting booked data.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={emergencyClosedToday}
                      onChange={(e) => setEmergencyClosedToday(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                  </label>
                </div>

                {emergencyClosedToday && (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={emergencyClosedMessage}
                      onChange={(e) => setEmergencyClosedMessage(e.target.value)}
                      placeholder="Reason message shown to visitors"
                      className="w-full px-3 py-2 bg-panel border border-line rounded-lg text-xs text-text focus:outline-none focus:border-brass"
                    />
                  </div>
                )}
              </div>

              {/* Walk-ins Enabled */}
              <div className="p-4 rounded-xl bg-subtle/50 border border-line-soft">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-text">Walk-in Bookings Enabled</h3>
                    <p className="text-[11.5px] text-muted mt-0.5">
                      Allows receptionists to create on-the-spot walk-in bookings from the admin panel POS.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={walkInsEnabled}
                      onChange={(e) => setWalkInsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Direct Contact Phone for Paused Bookings */}
            <div className="pt-2 border-t border-line-soft">
              <label className="text-xs font-semibold text-text uppercase tracking-wider block mb-1.5">
                Venue Contact Phone (Shown when bookings are paused)
              </label>
              <div className="max-w-md">
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-sm text-text placeholder:text-faint focus:outline-none focus:border-brass transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: CACHE & PERFORMANCE MANAGEMENT */}
          <div className="p-6 rounded-2xl bg-panel border border-line-soft space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-brass/15 text-brass border border-brass/30 flex items-center justify-center">
                    <Icon name="refresh" size={16} />
                  </div>
                  Cache & Performance
                </h2>
                <p className="text-xs text-muted leading-relaxed max-w-2xl">
                  Force the site to rebuild cached pages and re-check the database. Use after pricing/content updates if changes are slow to appear.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={clearingCache}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brass hover:bg-brass-bright text-ink font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95"
                >
                  {clearingCache ? (
                    <>
                      <Icon name="refresh" size={15} className="animate-spin" />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="trash" size={15} />
                      <span>Clear Cache Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Cache Result Toasts / Banners */}
            {cacheSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <Icon name="check" size={16} />
                <span>{cacheSuccessMessage}</span>
              </div>
            )}

            {cacheErrorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
                <Icon name="alert" size={16} />
                <span>{cacheErrorMessage}</span>
              </div>
            )}
          </div>

          {/* SECTION 5: BACKUP & DATA EXPORT */}
          <div className="p-6 rounded-2xl bg-panel border border-line-soft space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Icon name="download" size={16} />
                  </div>
                  Backup &amp; Data Export
                </h2>
                <p className="text-xs text-muted leading-relaxed max-w-2xl">
                  Download a complete, safe JSON backup of your database (Bookings, Customers, Pricing, Reviews, Gallery, and Live Sessions). Sensitive passwords are automatically excluded.
                </p>
                {lastBackupDate && (
                  <p className="text-[11px] text-muted flex items-center gap-1.5 pt-1 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    Last backup downloaded: <span className="text-text font-bold">{lastBackupDate}</span>
                  </p>
                )}
              </div>

              {/* Primary Download Data Export CTA */}
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={downloadingBackup}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-95 shrink-0"
              >
                {downloadingBackup ? (
                  <>
                    <Icon name="refresh" size={15} className="animate-spin" />
                    <span>Generating Backup…</span>
                  </>
                ) : (
                  <>
                    <Icon name="download" size={15} />
                    <span>Download Data Export (JSON)</span>
                  </>
                )}
              </button>
            </div>

            {/* Individual Export Shortcuts */}
            <div className="pt-3 border-t border-line-soft/80 flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1">
                Quick Single-Table Exports:
              </span>
              <button
                type="button"
                onClick={handleExportCustomers}
                disabled={exportingCustomers}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-subtle hover:bg-raised text-text border border-line text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Icon name="users" size={13} className="text-muted" />
                <span>Export Customers (CSV)</span>
              </button>
            </div>
          </div>

          {/* SECTION 6: SECURITY & DEVICE TRACKING */}
          <div className="p-6 rounded-2xl bg-panel border border-line-soft space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-line-soft pb-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Icon name="shield" size={16} />
                  </div>
                  Recent Logins & Recognized Devices
                </h2>
                <p className="text-xs text-muted leading-relaxed max-w-2xl">
                  Manage recognized browsers and devices that have accessed this Super Admin account. If you see an unrecognized device, revoke it immediately and change your password.
                </p>
              </div>
            </div>

            {loadingSessions ? (
              <div className="py-6 text-center text-muted text-xs flex flex-col items-center gap-2">
                <Icon name="refresh" size={16} className="animate-spin text-amber-400" />
                Loading security logs...
              </div>
            ) : loginSessions.length === 0 ? (
              <div className="py-6 text-center text-muted text-xs">
                No recent logins tracked.
              </div>
            ) : (
              <div className="space-y-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted uppercase tracking-wider text-[10px]">
                      <th className="pb-3 px-2 font-bold">Device & OS</th>
                      <th className="pb-3 px-2 font-bold">IP Address</th>
                      <th className="pb-3 px-2 font-bold">Location</th>
                      <th className="pb-3 px-2 font-bold">Last Seen</th>
                      <th className="pb-3 px-2 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {loginSessions.map((session, idx) => (
                      <tr key={session.id} className="hover:bg-subtle/50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex flex-col">
                            <span className="font-bold text-text">{session.browser}</span>
                            <span className="text-[11px] text-muted">{session.os}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 font-mono text-muted">{session.ipAddress || 'Unknown'}</td>
                        <td className="py-3 px-2 text-muted">{session.location || 'Unknown'}</td>
                        <td className="py-3 px-2 text-muted">
                          {new Date(session.lastSeenAt).toLocaleString('en-PK', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                          {idx === 0 && (
                            <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Current
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <button
                            onClick={() => handleRevokeSession(session.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-transparent hover:border-rose-500/30 text-[11px] font-bold transition-all cursor-pointer"
                            title="Revoke recognized device"
                          >
                            <Icon name="trash" size={13} />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-brass hover:bg-brass-bright text-ink font-bold text-sm shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Saving System Controls…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
