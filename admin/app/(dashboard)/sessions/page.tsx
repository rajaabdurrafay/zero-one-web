'use client';

import Link from 'next/link';
import { quote, elapsedSeconds, Snapshot } from '@zeroone/domain';
import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import useSWR from 'swr';
import {
  getLiveSessions,
  getSessionHistory,
  startLiveSession,
  updateLiveSessionAction,
  stopLiveSession,
  type ResourceSessionMatrix,
  type LiveSession,
  type SessionMode,
  type SessionAction,
  type PaymentMethod,
} from '@/lib/api';
import { Icon, type IconName } from '@/components/Icon';
import toast from 'react-hot-toast';

const RESOURCE_ICONS: Record<string, IconName> = {
  SNOOKER: 'crosshair',
  PS5_OPEN: 'gamepad',
  PS5_PRIVATE: 'play',
  CINEMA: 'film',
  TABLE_TENNIS: 'activity',
  CAR_SIMULATOR: 'gauge',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  SNOOKER: 'Snooker',
  PS5_OPEN: 'PS5 Open',
  PS5_PRIVATE: 'PS5 VIP Lounge',
  CINEMA: 'Private Cinema',
  TABLE_TENNIS: 'Table Tennis',
  CAR_SIMULATOR: 'Racing Simulator',
};

function formatSeconds(totalSec: number) {
  const isNegative = totalSec < 0;
  const absSec = Math.abs(totalSec);
  const hrs = Math.floor(absSec / 3600);
  const mins = Math.floor((absSec % 3600) / 60);
  const secs = absSec % 60;

  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');

  if (hrs > 0) {
    return `${isNegative ? '-' : ''}${hrs}:${paddedMins}:${paddedSecs}`;
  }
  return `${isNegative ? '-' : ''}${paddedMins}:${paddedSecs}`;
}

export default function LiveSessionsPage() {
  const [filterType, setFilterType] = useState<string>('ALL');

  // Modal Dialog States
  const [startModalResource, setStartModalResource] = useState<{ id: string; name: string; type: string } | null>(null);
  const [startMode, setStartMode] = useState<SessionMode>('COUNTDOWN');
  const openStart=useCallback((item:ResourceSessionMatrix)=>{setStartModalResource({id:item.resourceId,name:item.resourceName,type:item.resourceType});setStartMode(item.resourceType==='SNOOKER' ? 'COUNT_UP':'COUNTDOWN')},[]);
  const [startDuration, setStartDuration] = useState<number>(60);
  const [startCustomerName, setStartCustomerName] = useState<string>('');
  const [startSubmitting, setStartSubmitting] = useState<boolean>(false);

  // Extend Modal
  const [extendModalSession, setExtendModalSession] = useState<LiveSession | null>(null);
  const [extendMinutes, setExtendMinutes] = useState<number>(15);
  const [extendSubmitting, setExtendSubmitting] = useState<boolean>(false);

  // Checkout / Stop Modal
  const [stopModalSession, setStopModalSession] = useState<LiveSession | null>(null);
  const [stopPaymentMethod, setStopPaymentMethod] = useState<PaymentMethod>('CASH');
  const [lastBill,setLastBill]=useState<{session:LiveSession;finalAmount:number;totalElapsedMinutes:number}|null>(null);
  const [receivedAmount,setReceivedAmount]=useState('');
  const [stopSubmitting, setStopSubmitting] = useState<boolean>(false);

  const {data:history,mutate:refreshHistory}=useSWR('session-history',getSessionHistory,{refreshInterval:15000});
  // Poll live sessions matrix every 4 seconds
  const { data: matrix, mutate: refreshMatrix, isLoading } = useSWR<ResourceSessionMatrix[]>(
    'admin-live-sessions-matrix',
    () => getLiveSessions(),
    {
      refreshInterval: 4000,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    }
  );

  const resourceTypes = useMemo(() => {
    if (!matrix) return [];
    const types = new Set(matrix.map((m) => m.resourceType));
    return Array.from(types);
  }, [matrix]);

  const filteredMatrix = useMemo(() => {
    if (!matrix) return [];
    if (filterType === 'ALL') return matrix;
    return matrix.filter((m) => m.resourceType === filterType);
  }, [matrix, filterType]);

  // Overall Statistics
  const stats = useMemo(() => {
    if (!matrix) return { total: 0, inUse: 0, free: 0, paused: 0, timeUp: 0 };
    const total = matrix.length;
    let inUse = 0;
    let free = 0;
    let paused = 0;
    let timeUp = 0;

    matrix.forEach((item) => {
      const s = item.activeSession;
      if (!s) {
        free++;
      } else if (s.status === 'PAUSED') {
        paused++;
        inUse++;
      } else {
        inUse++;
        if (s.mode === 'COUNTDOWN') {
          const totalAllowed = ((s.plannedMinutes || 60) + s.extendedMinutes) * 60;
          const elapsed = elapsedSeconds(s,Date.parse(s.serverTime || s.updatedAt));
          if (totalAllowed - elapsed <= 0) {
            timeUp++;
          }
        }
      }
    });

    return { total, inUse, free, paused, timeUp };
  }, [matrix]);

  // Actions
  async function handleStartSession(e: React.FormEvent) {
    e.preventDefault();
    if (!startModalResource) return;
    setStartSubmitting(true);
    try {
      await startLiveSession({
        resourceId: startModalResource.id,
        mode: startMode,
        plannedMinutes: startMode === 'COUNTDOWN' ? Number(startDuration) : null,
        customerName: startCustomerName.trim() || null,
      });
      toast.success(`Session started on ${startModalResource.name}!`);
      setStartModalResource(null);
      setStartCustomerName('');
      refreshMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start session');
    } finally {
      setStartSubmitting(false);
    }
  }

  async function handleQuickAction(session: LiveSession, action: SessionAction, minutes?: number) {
    try {
      await updateLiveSessionAction(session.id, action, minutes);
      toast.success(
        action === 'PAUSE'
          ? 'Session paused'
          : action === 'RESUME'
          ? 'Session resumed'
          : `Extended by +${minutes} mins`
      );
      refreshMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  }

  async function handleExtendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!extendModalSession) return;
    setExtendSubmitting(true);
    try {
      await updateLiveSessionAction(extendModalSession.id, 'EXTEND', Number(extendMinutes));
      toast.success(`Added +${extendMinutes} minutes to session!`);
      setExtendModalSession(null);
      refreshMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Failed to extend session');
    } finally {
      setExtendSubmitting(false);
    }
  }

  async function handleStopSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stopModalSession) return;
    setStopSubmitting(true);
    try {
      const res = await stopLiveSession(stopModalSession.id, stopPaymentMethod,receivedAmount.trim() ? Number(receivedAmount):undefined);
      setLastBill(res);setReceivedAmount('');void refreshHistory();
      toast.success(
        `Session ended! Bill: ₨ ${res.finalAmount.toLocaleString()} (${res.totalElapsedMinutes} mins)`
      );
      setStopModalSession(null);
      refreshMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop session');
    } finally {
      setStopSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {lastBill && <div className="panel p-5 space-y-2"><h2 className="font-bold">Final bill: Rs {lastBill.finalAmount.toLocaleString()}</h2><p>{lastBill.totalElapsedMinutes} billable minutes</p>{lastBill.session.bookingId && <Link className="btn btn-primary" href={'/bookings/'+lastBill.session.bookingId}>Open final booking and receipt</Link>}<button className="btn btn-ghost ml-3" onClick={()=>setLastBill(null)}>Close</button></div>}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line-soft pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] sm:text-[26px] font-bold text-text tracking-tight">
              Live Arena &amp; Station Timers
            </h1>
            <span className="pill pill-live flex items-center gap-1.5 text-[11px] font-bold">
              <span className="pulse-dot" /> Real-time
            </span>
          </div>
          <p className="text-[13px] text-muted mt-1">
            Govern active bays, monitor countdowns &amp; count-ups, pause games, add overtime, and bill walk-ins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refreshMatrix()}
            className="btn btn-ghost px-3.5 py-2 text-[12.5px] font-semibold flex items-center gap-2 cursor-pointer"
          >
            <Icon name="refresh" size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
        <div className="panel p-3.5 sm:p-4 rounded-2xl border-line flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-raised border border-line-soft flex items-center justify-center text-text font-bold">
            <Icon name="layers" size={18} />
          </div>
          <div>
            <span className="eyebrow text-[9.5px]">Total Stations</span>
            <p className="display text-[20px] font-bold text-text mt-0.5">{stats.total}</p>
          </div>
        </div>

        <div className="panel p-3.5 sm:p-4 rounded-2xl border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
            <Icon name="check" size={18} />
          </div>
          <div>
            <span className="eyebrow text-[9.5px] text-emerald-500">Available</span>
            <p className="display text-[20px] font-bold text-emerald-400 mt-0.5">{stats.free}</p>
          </div>
        </div>

        <div className="panel p-3.5 sm:p-4 rounded-2xl border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Icon name="play" size={18} />
          </div>
          <div>
            <span className="eyebrow text-[9.5px] text-amber-500">In Play</span>
            <p className="display text-[20px] font-bold text-amber-400 mt-0.5">{stats.inUse}</p>
          </div>
        </div>

        <div className="panel p-3.5 sm:p-4 rounded-2xl border-blue-500/20 bg-blue-500/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            <Icon name="pause" size={18} />
          </div>
          <div>
            <span className="eyebrow text-[9.5px] text-blue-400">Paused</span>
            <p className="display text-[20px] font-bold text-blue-400 mt-0.5">{stats.paused}</p>
          </div>
        </div>

        <div className="panel p-3.5 sm:p-4 rounded-2xl border-rose-500/20 bg-rose-500/5 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 font-bold animate-pulse">
            <Icon name="alert" size={18} />
          </div>
          <div>
            <span className="eyebrow text-[9.5px] text-rose-400">Time Up</span>
            <p className="display text-[20px] font-bold text-rose-400 mt-0.5">{stats.timeUp}</p>
          </div>
        </div>
      </div>

      {/* Type Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
            filterType === 'ALL'
              ? 'bg-brass text-ink font-bold shadow-xs'
              : 'bg-panel border border-line-soft text-muted hover:text-text'
          }`}
        >
          All Stations ({matrix?.length || 0})
        </button>
        {resourceTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filterType === t
                ? 'bg-brass text-ink font-bold shadow-xs'
                : 'bg-panel border border-line-soft text-muted hover:text-text'
            }`}
          >
            {RESOURCE_TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* Grid of Resource Cards */}
      {isLoading && !matrix ? (
        <div className="py-24 text-center text-muted text-[13px] flex items-center justify-center gap-2">
          <span className="spinner" />
          Loading Live Arena Matrix…
        </div>
      ) : filteredMatrix.length === 0 ? (
        <div className="panel py-16 text-center text-muted p-8">
          <Icon name="clock" size={28} className="mx-auto mb-2 text-muted" />
          <p className="text-[15px] font-bold text-text">No stations found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMatrix.map(item=><SessionCard key={item.resourceId} item={item} onStart={openStart} onExtend={setExtendModalSession} onStop={setStopModalSession} onQuickAction={handleQuickAction} />)}
        </div>
      )}

      <section className="panel p-5 space-y-3"><h2 className="font-bold">Recent final bills</h2>{!history?.length && <p className="text-muted">No completed sessions yet.</p>}{history?.map(session=><div className="flex items-center justify-between" key={session.id}><span>{session.resource?.name || 'Station'} · Rs {(session.finalAmount || 0).toLocaleString()}</span>{session.bookingId && <Link className="text-brass" href={'/bookings/'+session.bookingId}>Receipt</Link>}</div>)}</section>
      {/* 1. START SESSION MODAL */}
      {startModalResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="panel max-w-md w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brass/10 text-brass">
                  <Icon name="play" size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-text">Start Live Session</h3>
                  <p className="text-[11px] text-muted">{startModalResource.name}</p>
                </div>
              </div>
              <button
                onClick={() => setStartModalResource(null)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleStartSession} className="mt-5 space-y-4">
              <div>
                <label className="field-label">Customer / Player Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ali Ahmed (or leave empty for Walk-in)"
                  value={startCustomerName}
                  onChange={(e) => setStartCustomerName(e.target.value)}
                  className="field"
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label">Session Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setStartMode('COUNTDOWN')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      startMode === 'COUNTDOWN'
                        ? 'border-brass bg-brass/10 text-brass font-bold'
                        : 'border-line-soft bg-raised text-muted'
                    }`}
                  >
                    <div className="text-[13px] font-bold">⏱ Fixed Countdown</div>
                    <div className="text-[10.5px] mt-0.5 opacity-80">Sets target duration &amp; alarms</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStartMode('COUNT_UP')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      startMode === 'COUNT_UP'
                        ? 'border-brass bg-brass/10 text-brass font-bold'
                        : 'border-line-soft bg-raised text-muted'
                    }`}
                  >
                    <div className="text-[13px] font-bold">📈 Open Stopwatch</div>
                    <div className="text-[10.5px] mt-0.5 opacity-80">Pay-as-you-play per minute</div>
                  </button>
                </div>
              </div>

              {startMode === 'COUNTDOWN' && (
                <div>
                  <label className="field-label">Initial Duration</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {[30, 60, 90, 120].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setStartDuration(mins)}
                        className={`py-2 text-center rounded-xl text-[12.5px] font-bold border transition-all ${
                          startDuration === mins
                            ? 'border-brass bg-brass text-ink font-extrabold'
                            : 'border-line-soft bg-raised text-text hover:border-brass/40'
                        }`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={startDuration}
                    onChange={(e) => setStartDuration(parseInt(e.target.value, 10) || 30)}
                    className="field mt-2 tnum"
                    placeholder="Custom minutes..."
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setStartModalResource(null)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={startSubmitting}
                  className="btn btn-primary py-2 px-5 text-[13px] font-bold"
                >
                  {startSubmitting ? 'Starting…' : 'Start Session Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EXTEND TIME MODAL */}
      {extendModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="panel max-w-sm w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Icon name="plus" size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-text">Extend Play Time</h3>
                  <p className="text-[11px] text-muted">
                    {extendModalSession.customerDisplay || 'Active Player'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExtendModalSession(null)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="mt-5 space-y-4">
              <div>
                <label className="field-label">Select Additional Minutes</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[15, 30, 60].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setExtendMinutes(mins)}
                      className={`py-2.5 text-center rounded-xl text-[13px] font-bold border transition-all ${
                        extendMinutes === mins
                          ? 'border-amber-400 bg-amber-500 text-ink font-extrabold'
                          : 'border-line-soft bg-raised text-text hover:border-amber-400/40'
                      }`}
                    >
                      +{mins} Min
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={extendMinutes}
                  onChange={(e) => setExtendMinutes(parseInt(e.target.value, 10) || 15)}
                  className="field mt-2 tnum"
                  placeholder="Custom minutes..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setExtendModalSession(null)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendSubmitting}
                  className="btn btn-primary py-2 px-5 text-[13px] font-bold"
                >
                  {extendSubmitting ? 'Updating…' : 'Add Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. STOP / CHECKOUT BILLING MODAL */}
      {stopModalSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/85 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="panel max-w-md w-full p-6 shadow-2xl border-line-soft animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-line-soft">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400">
                  <Icon name="check" size={18} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-text">Complete Session &amp; Bill</h3>
                  <p className="text-[11px] text-muted">
                    {stopModalSession.customerDisplay || 'Walk-in Guest'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStopModalSession(null)}
                className="text-muted hover:text-text p-1 rounded-lg"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <form onSubmit={handleStopSubmit} className="mt-5 space-y-4">
              <SessionAmount session={stopModalSession} />
              <label className="field-label">Total amount received (optional)</label><input className="field" type="number" min="0" step="0.01" value={receivedAmount} onChange={event=>setReceivedAmount(event.target.value)} placeholder="Preserve recorded payment" />
              <div className="p-4 rounded-xl bg-raised border border-line-soft space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">Player / Reservation:</span>
                  <span className="font-bold text-text">{stopModalSession.customerDisplay}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted">Start Time:</span>
                  <span className="font-mono text-text">
                    {new Date(stopModalSession.startedAt).toLocaleTimeString('en-PK', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              </div>

              <div>
                <label className="field-label">Payment Method Received</label>
                <select
                  value={stopPaymentMethod}
                  onChange={(e) => setStopPaymentMethod(e.target.value as PaymentMethod)}
                  className="field"
                >
                  <option value="CASH">Cash at Counter</option>
                  <option value="ONLINE_JAZZCASH">JazzCash</option>
                  <option value="ONLINE_EASYPAISA">Easypaisa</option>
                  <option value="ONLINE_BANK">Direct Bank Transfer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setStopModalSession(null)}
                  className="btn btn-secondary py-2 px-4 text-[13px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stopSubmitting}
                  className="btn btn-danger py-2 px-5 text-[13px] font-bold"
                >
                  {stopSubmitting ? 'Finalizing…' : 'Confirm Stop & Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionAmount({session}:{session:LiveSession}) {
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(session.status!=='RUNNING')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[session.status]);
  const snapshot=session.pricingSnapshot;
  if(!snapshot)return <p className="text-muted">Bill available at checkout</p>;
  const minutes=session.mode==='COUNT_UP' ? Math.max(1,Math.ceil(elapsedSeconds(session,now)/60)) : (session.plannedMinutes || 60)+session.extendedMinutes;
  const bill=quote(snapshot.rate,minutes,snapshot.offer,session.booking?.addons || []);
  return <p className="text-brass font-bold">Live bill: Rs {bill.payablePrice.toLocaleString()} <span className="text-muted text-xs">({minutes} min)</span></p>;
}

const SessionCard=memo(function SessionCard({item,onStart,onExtend,onStop,onQuickAction}:{item:ResourceSessionMatrix;onStart:(item:ResourceSessionMatrix)=>void;onExtend:(s:LiveSession|null)=>void;onStop:(s:LiveSession|null)=>void;onQuickAction:(s:LiveSession,a:SessionAction)=>void}) {
  const [currentTime,setCurrentTime]=useState(Date.now);
  useEffect(()=>{if(!item.activeSession || item.activeSession.status!=='RUNNING')return;const timer=setInterval(()=>setCurrentTime(Date.now()),1000);return()=>clearInterval(timer)},[item.activeSession]);

            const session = item.activeSession;
            const isFree = !session;
            const isPaused = session?.status === 'PAUSED';

            // Calculate timing for active session
            let elapsedSec = 0;
            let remainingSec = 0;
            let totalAllowedSec = 0;
            let progressPercent = 0;
            let isTimeUp = false;

            if (session) {
              elapsedSec=elapsedSeconds(session,currentTime);

              if (session.mode === 'COUNTDOWN') {
                totalAllowedSec = ((session.plannedMinutes || 60) + session.extendedMinutes) * 60;
                remainingSec = totalAllowedSec - elapsedSec;
                isTimeUp = remainingSec <= 0;
                progressPercent = Math.min(100, Math.max(0, (elapsedSec / totalAllowedSec) * 100));
              }
            }

            return (
              <div
                key={item.resourceId}
                className={`panel p-5 rounded-2xl flex flex-col justify-between transition-all relative overflow-hidden border ${
                  isFree
                    ? 'border-line hover:border-emerald-500/40 bg-panel'
                    : isPaused
                    ? 'border-blue-500/40 bg-blue-950/10'
                    : isTimeUp
                    ? 'border-rose-500 bg-rose-950/20 shadow-[0_0_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500'
                    : 'border-brass/40 bg-panel hover:border-brass'
                }`}
              >
                {/* Top Header: Resource Name & Icon & Status Pill */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isFree
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isPaused
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : isTimeUp
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                            : 'bg-brass/10 text-brass border-brass/20'
                        }`}
                      >
                        <Icon name={RESOURCE_ICONS[item.resourceType] || 'grid'} size={20} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold text-text leading-tight">{item.resourceName}</h3>
                        <span className="text-[11px] text-muted font-medium">
                          {RESOURCE_TYPE_LABELS[item.resourceType] || item.resourceType}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`pill text-[10.5px] font-bold shrink-0 ${
                        isFree
                          ? 'pill-live bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : isPaused
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          : isTimeUp
                          ? 'pill-stop bg-rose-600 text-white font-mono animate-bounce'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {isFree
                        ? 'AVAILABLE'
                        : isPaused
                        ? 'PAUSED'
                        : isTimeUp
                        ? 'TIME EXPIRED'
                        : session?.mode === 'COUNTDOWN'
                        ? 'COUNTDOWN'
                        : 'OPEN TIMER'}
                    </span>
                  </div>

                  {/* Body Content */}
                  {isFree ? (
                    <div className="my-8 text-center py-3 rounded-xl bg-raised/40 border border-line-soft">
                      <p className="text-[13px] text-muted">Bay is currently vacant &amp; ready</p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {/* Customer Info */}
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-raised/60 border border-line-soft">
                        <div className="min-w-0">
                          <span className="eyebrow text-[9px]">Active Player / Booking</span>
                          <p className="text-[13px] font-bold text-text truncate">
                            {session?.customerDisplay}
                          </p>
                        </div>
                        {session?.bookingId && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-panel border border-line-soft text-brass font-bold">
                            Online Res
                          </span>
                        )}
                      </div>

                      <SessionAmount session={session!} />
                      {/* Main Timer Display */}
                      <div
                        className={`p-4 rounded-2xl border text-center relative overflow-hidden ${
                          isTimeUp
                            ? 'bg-rose-500/15 border-rose-500/50'
                            : isPaused
                            ? 'bg-blue-500/10 border-blue-500/30'
                            : 'bg-ink/50 border-line-soft'
                        }`}
                      >
                        <span className="eyebrow text-[9.5px]">
                          {session?.mode === 'COUNTDOWN'
                            ? isTimeUp
                              ? 'Overtime Elapsed'
                              : 'Time Remaining'
                            : 'Elapsed Playing Time'}
                        </span>
                        <div
                          className={`display text-[32px] font-bold tracking-tight font-mono mt-0.5 ${
                            isTimeUp
                              ? 'text-rose-400 animate-pulse'
                              : isPaused
                              ? 'text-blue-300'
                              : 'text-text'
                          }`}
                        >
                          {session?.mode === 'COUNTDOWN'
                            ? isTimeUp
                              ? `+${formatSeconds(Math.abs(remainingSec))}`
                              : formatSeconds(remainingSec)
                            : formatSeconds(elapsedSec)}
                        </div>

                        {/* Progress Bar for Countdown Mode */}
                        {session?.mode === 'COUNTDOWN' && (
                          <div className="mt-3 w-full bg-raised rounded-full h-2 overflow-hidden border border-line-soft">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isTimeUp
                                  ? 'bg-rose-500'
                                  : progressPercent > 80
                                  ? 'bg-amber-500'
                                  : 'bg-brass'
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-muted mt-2 px-1">
                          <span>
                            Started:{' '}
                            {new Date(session!.startedAt).toLocaleTimeString('en-PK', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,timeZone:'Asia/Karachi',
                                              })}
                          </span>
                          {session?.extendedMinutes ? (
                            <span className="text-amber-400 font-bold">
                              +{session.extendedMinutes}m added
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="mt-4 pt-3 border-t border-line-soft">
                  {isFree ? (
                    <button
                      type="button"
                      onClick={() => {
                        onStart(item);
                      }}
                      className="btn btn-primary w-full py-2.5 text-[13px] font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <Icon name="play" size={15} />
                      <span>Start Session</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {/* Controller Row */}
                      <div className="grid grid-cols-3 gap-2">
                        {isPaused ? (
                          <button
                            type="button"
                            onClick={() => onQuickAction(session!, 'RESUME')}
                            className="btn btn-secondary py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                          >
                            <Icon name="play" size={13} />
                            <span>Resume</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onQuickAction(session!, 'PAUSE')}
                            className="btn btn-secondary py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 cursor-pointer"
                          >
                            <Icon name="pause" size={13} />
                            <span>Pause</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onExtend(session)}
                          className="btn btn-secondary py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer"
                        >
                          <Icon name="plus" size={13} />
                          <span>+ Extend</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onStop(session)}
                          className="btn btn-danger py-2 text-[12px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Icon name="check" size={13} />
                          <span>Stop &amp; Bill</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
});
