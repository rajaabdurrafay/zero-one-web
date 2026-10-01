'use client';

import { useEffect, useState } from 'react';
import { getPricing, updatePricing, type Activity } from '@/lib/api';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';

interface ToastNotification {
  id: number;
  type: 'success' | 'error';
  message: string;
}

export default function PricingPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedUnits, setEditedUnits] = useState<Record<string, 'PER_HOUR' | 'PER_MINUTE'>>({});
  const [editedHalfHour, setEditedHalfHour] = useState<Record<string, string>>({});
  const [editedFullHour, setEditedFullHour] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  function showToast(type: 'success' | 'error', message: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }

  function removeToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    setLoading(true);
    setError('');
    try {
      const data = await getPricing();
      setActivities(data);
      const initialPrices: Record<string, number> = {};
      const initialUnits: Record<string, 'PER_HOUR' | 'PER_MINUTE'> = {};
      const initialHalfHour: Record<string, string> = {};
      const initialFullHour: Record<string, string> = {};
      data.forEach((act) => {
        initialPrices[act.id] = act.basePrice;
        initialUnits[act.id] = act.pricingUnit;
        initialHalfHour[act.id] = act.halfHourPrice != null ? String(act.halfHourPrice) : '';
        initialFullHour[act.id] = act.fullHourPrice != null ? String(act.fullHourPrice) : '';
      });
      setEditedPrices(initialPrices);
      setEditedUnits(initialUnits);
      setEditedHalfHour(initialHalfHour);
      setEditedFullHour(initialFullHour);
    } catch (err: any) {
      setError(err.message || 'Could not load pricing');
      showToast('error', 'Could not load pricing: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
    }
  }

  function handlePriceChange(id: string, valueStr: string) {
    const parsed = parseFloat(valueStr);
    setEditedPrices((prev) => ({ ...prev, [id]: isNaN(parsed) ? 0 : parsed }));
  }

  function handleUnitChange(id: string, newUnit: 'PER_HOUR' | 'PER_MINUTE') {
    setEditedUnits((prev) => ({ ...prev, [id]: newUnit }));
  }

  function handleHalfHourChange(id: string, valueStr: string) {
    setEditedHalfHour((prev) => ({ ...prev, [id]: valueStr }));
  }

  function handleFullHourChange(id: string, valueStr: string) {
    setEditedFullHour((prev) => ({ ...prev, [id]: valueStr }));
  }

  async function handleUpdatePrice(activity: Activity) {
    const newPrice = editedPrices[activity.id];
    const newUnit = editedUnits[activity.id] || activity.pricingUnit;
    const rawHalf = editedHalfHour[activity.id] ?? '';
    const rawFull = editedFullHour[activity.id] ?? '';

    const newHalfHour = rawHalf.trim() === '' ? null : parseInt(rawHalf, 10);
    const newFullHour = rawFull.trim() === '' ? null : parseInt(rawFull, 10);

    if (newPrice === undefined || isNaN(newPrice) || newPrice < 0) {
      showToast('error', `Enter a price of zero or more for ${activity.name}`);
      return;
    }

    if (newHalfHour !== null && (isNaN(newHalfHour) || newHalfHour < 0)) {
      showToast('error', 'Enter a valid 30-minute price, or leave it empty');
      return;
    }

    if (newFullHour !== null && (isNaN(newFullHour) || newFullHour < 0)) {
      showToast('error', 'Enter a valid 1-hour price, or leave it empty');
      return;
    }

    const priceChanged = newPrice !== activity.basePrice;
    const unitChanged = newUnit !== activity.pricingUnit;
    const origHalf = activity.halfHourPrice ?? null;
    const origFull = activity.fullHourPrice ?? null;
    const halfChanged = newHalfHour !== origHalf;
    const fullChanged = newFullHour !== origFull;

    if (!priceChanged && !unitChanged && !halfChanged && !fullChanged) {
      showToast('error', `Nothing changed for ${activity.name}`);
      return;
    }

    setUpdatingId(activity.id);
    try {
      const updated = await updatePricing(activity.id, {
        basePrice: newPrice,
        pricingUnit: newUnit,
        halfHourPrice: newHalfHour,
        fullHourPrice: newFullHour,
      });

      setActivities((prev) => prev.map((item) => (item.id === activity.id ? updated : item)));
      setEditedPrices((prev) => ({ ...prev, [activity.id]: updated.basePrice }));
      setEditedUnits((prev) => ({ ...prev, [activity.id]: updated.pricingUnit }));
      setEditedHalfHour((prev) => ({
        ...prev,
        [activity.id]: updated.halfHourPrice != null ? String(updated.halfHourPrice) : '',
      }));
      setEditedFullHour((prev) => ({
        ...prev,
        [activity.id]: updated.fullHourPrice != null ? String(updated.fullHourPrice) : '',
      }));

      const tieredMsg =
        updated.halfHourPrice && updated.fullHourPrice
          ? ` · slabs ₨${updated.halfHourPrice}/30m, ₨${updated.fullHourPrice}/1h`
          : '';

      showToast(
        'success',
        `${activity.name} now ₨${updated.basePrice.toLocaleString()}/${
          updated.pricingUnit === 'PER_HOUR' ? 'hour' : 'min'
        }${tieredMsg}`
      );
    } catch (err: any) {
      showToast('error', `Could not update ${activity.name}: ` + (err.message || 'Error occurred'));
    } finally {
      setUpdatingId(null);
    }
  }

  function handleReset(activity: Activity) {
    setEditedPrices((prev) => ({ ...prev, [activity.id]: activity.basePrice }));
    setEditedUnits((prev) => ({ ...prev, [activity.id]: activity.pricingUnit }));
    setEditedHalfHour((prev) => ({
      ...prev,
      [activity.id]: activity.halfHourPrice != null ? String(activity.halfHourPrice) : '',
    }));
    setEditedFullHour((prev) => ({
      ...prev,
      [activity.id]: activity.fullHourPrice != null ? String(activity.fullHourPrice) : '',
    }));
  }

  return (
    <div className="space-y-6">
      {/* Toasts */}
      <div className="fixed top-[72px] right-4 sm:right-7 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto panel px-4 py-3 flex items-start justify-between gap-3 text-[12px] ${
              toast.type === 'success' ? 'border-live/45' : 'border-stop/45'
            }`}
          >
            <span className="flex items-start gap-2.5">
              <Icon
                name={toast.type === 'success' ? 'check' : 'alert'}
                size={14}
                className={`mt-px ${toast.type === 'success' ? 'text-live' : 'text-stop'}`}
              />
              <span className="text-text">{toast.message}</span>
            </span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-faint hover:text-text transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted max-w-xl">
          Rates apply to the website and the booking flow the moment you save them.
        </p>
        <button onClick={loadPricing} disabled={loading} className="btn btn-ghost">
          {loading ? <span className="spinner" /> : <Icon name="refresh" size={14} />}
          Refresh
        </button>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5">
          <Icon name="alert" size={14} className="mt-px" />
          <span>{error}</span>
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-muted text-[13px]">
          <span className="spinner" />
          Loading rates…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activities.map((activity) => {
            const currentEditingPrice = editedPrices[activity.id] ?? activity.basePrice;
            const currentEditingUnit = editedUnits[activity.id] ?? activity.pricingUnit;
            const currentEditingHalf = editedHalfHour[activity.id] ?? '';
            const currentEditingFull = editedFullHour[activity.id] ?? '';

            const priceChanged = currentEditingPrice !== activity.basePrice;
            const unitChanged = currentEditingUnit !== activity.pricingUnit;
            const origHalfStr = activity.halfHourPrice != null ? String(activity.halfHourPrice) : '';
            const origFullStr = activity.fullHourPrice != null ? String(activity.fullHourPrice) : '';
            const halfChanged = currentEditingHalf !== origHalfStr;
            const fullChanged = currentEditingFull !== origFullStr;
            const hasChanged = priceChanged || unitChanged || halfChanged || fullChanged;
            const isUpdating = updatingId === activity.id;

            const isHourly = currentEditingUnit === 'PER_HOUR';
            const hasTieredActive = activity.halfHourPrice != null && activity.fullHourPrice != null;

            return (
              <section
                key={activity.id}
                className={`panel p-5 flex flex-col ${hasChanged ? 'border-brass/50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="display text-[19px] text-text truncate">{activity.name}</h2>
                    <p className="eyebrow mt-1">{activity.resourceType}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                    {hasTieredActive && <span className="pill pill-bare pill-brass">Slabs</span>}
                    <span className="pill pill-bare pill-neutral">{isHourly ? 'Hourly' : 'Per minute'}</span>
                  </div>
                </div>

                <div className="mt-4 bg-raised border border-line rounded-xl px-3.5 py-3">
                  <p className="eyebrow">Live rate</p>
                  <p className="display tnum text-[28px] text-text mt-1.5">
                    <span className="text-brass">₨</span>
                    {activity.basePrice.toLocaleString()}
                    <span className="text-[13px] text-faint ml-1.5">
                      /{activity.pricingUnit === 'PER_HOUR' ? 'hr' : 'min'}
                    </span>
                  </p>
                  {hasTieredActive && (
                    <p className="text-[11px] text-muted tnum mt-2 pt-2 border-t border-line-soft">
                      ₨{activity.halfHourPrice?.toLocaleString()} / 30 min · ₨
                      {activity.fullHourPrice?.toLocaleString()} / 1 hr
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-5 border-t border-line space-y-4 flex-1 flex flex-col">
                  <div>
                    <Select
                      id={`unit-${activity.id}`}
                      label="Billed by"
                      value={currentEditingUnit}
                      onChange={(val) => handleUnitChange(activity.id, val as 'PER_HOUR' | 'PER_MINUTE')}
                      options={[
                        { value: 'PER_HOUR', label: 'Per hour' },
                        { value: 'PER_MINUTE', label: 'Per minute' },
                      ]}
                    />
                  </div>

                  <div>
                    <label htmlFor={`price-${activity.id}`} className="field-label">
                      Base price
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-brass text-[13px]">
                        ₨
                      </span>
                      <input
                        id={`price-${activity.id}`}
                        type="number"
                        min="0"
                        step={isHourly ? '50' : '1'}
                        value={currentEditingPrice}
                        onChange={(e) => handlePriceChange(activity.id, e.target.value)}
                        className="field tnum pl-10 pr-14 font-semibold"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-faint">
                        /{isHourly ? 'hour' : 'min'}
                      </span>
                    </div>
                  </div>

                  <fieldset className="border border-line rounded-[4px] p-3.5">
                    <legend className="eyebrow px-1.5">Slab pricing — optional</legend>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label htmlFor={`half-${activity.id}`} className="field-label">
                          30 min
                        </label>
                        <input
                          id={`half-${activity.id}`}
                          type="number"
                          min="0"
                          step="50"
                          value={currentEditingHalf}
                          onChange={(e) => handleHalfHourChange(activity.id, e.target.value)}
                          placeholder="500"
                          className="field tnum"
                        />
                      </div>
                      <div>
                        <label htmlFor={`full-${activity.id}`} className="field-label">
                          1 hour
                        </label>
                        <input
                          id={`full-${activity.id}`}
                          type="number"
                          min="0"
                          step="50"
                          value={currentEditingFull}
                          onChange={(e) => handleFullHourChange(activity.id, e.target.value)}
                          placeholder="900"
                          className="field tnum"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-faint mt-2.5 leading-relaxed">
                      Leave both empty to bill straight from the base price.
                    </p>
                  </fieldset>

                  <div className="flex items-center gap-2 mt-auto pt-1">
                    {hasChanged && (
                      <button
                        type="button"
                        onClick={() => handleReset(activity)}
                        disabled={isUpdating}
                        className="btn btn-ghost"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleUpdatePrice(activity)}
                      disabled={isUpdating || !hasChanged}
                      className={`btn flex-1 py-2.5 ${hasChanged ? 'btn-primary' : 'btn-ghost'}`}
                    >
                      {isUpdating && <span className="spinner" />}
                      {isUpdating ? 'Saving…' : hasChanged ? 'Save rate' : 'Saved'}
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
