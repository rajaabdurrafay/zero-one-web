'use client';

import { activityPrice, money, businessInstant, businessDate } from '@zeroone/domain';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAvailability,
  createBooking,
  createGroupBooking,
  getPricing,
  getAddons,
  type Activity,
  type Resource,
  type PaymentMethod,
  type AddonItem,
} from '@/lib/api';
import { getNext7Days } from '@/lib/timeUtils';
import DateChipsSelector from '@/components/DateChipsSelector';
import { Icon } from '@/components/Icon';
import { isValidEmail, isValidPakistaniPhone } from '@/lib/validation';

function Step({ n, title, children }: { n?: number; title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="display text-[16px] text-text flex items-center gap-2.5">
          {n !== undefined && <span className="tnum text-brass text-[13px]">{String(n).padStart(2, '0')}</span>}
          {title}
        </h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

interface AdminGroupCartItem {
  id: string;
  activityId: string;
  activityName: string;
  resourceId: string;
  resourceName: string;
  date: string;
  startTime: string;
  duration: number;
  price: number;
}

export default function NewBookingPage() {
  const router = useRouter();
  const next7Days = useMemo(() => getNext7Days(), []);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupCart, setGroupCart] = useState<AdminGroupCartItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [addonsList, setAddonsList] = useState<AddonItem[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [date, setDate] = useState(next7Days[0]?.dateStr || businessDate());
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(Math.ceil(now.getMinutes() / 5) * 5 % 60).padStart(2, '0');
    return `${hours}:${minutes}`;
  });
  const [duration, setDuration] = useState<number>(60);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerTouched, setCustomerTouched] = useState({ name: false, phone: false, email: false });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);



  async function loadAddonsList() {
    try {
      const data = await getAddons(false);
      setAddonsList(data.filter((a) => a.isAvailable));
    } catch (e) {
      console.error('Failed to load addons for walkin:', e);
    }
  }


  async function loadActivities() {
    try {
      setActivities(await getPricing());
    } catch (err: any) {
      setError('Could not load activities: ' + err.message);
    }
  }


  async function loadResources() {
    try {
      const activity = activities.find((a) => a.id === selectedActivity);
      if (!activity) return;
      const data = await getAvailability(date, activity.resourceType);
      setResources(data.resources);
      setSelectedResource('');
    } catch (err: any) {
      setError('Could not load bays: ' + err.message);
    }
  }

  useEffect(() => {
    loadActivities();
    loadAddonsList();
  }, []);

  useEffect(() => {
    if (selectedActivity && date) {
      loadResources();
    }
  }, [selectedActivity, date]);

  const selectedActivityData = useMemo(
    () => activities.find((a) => a.id === selectedActivity),
    [activities, selectedActivity]
  );

  useEffect(() => {
    if (selectedActivityData) {
      const hasTiered =
        selectedActivityData.halfHourPrice != null && selectedActivityData.fullHourPrice != null;
      setDuration(hasTiered || selectedActivityData.pricingUnit === 'PER_MINUTE' ? 30 : 60);
    }
  }, [selectedActivityData]);

  function handleAddonQtyChange(addonId: string, delta: number) {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      const next = Math.max(0, current + delta);
      const addon = addonsList.find((a) => a.id === addonId);
      if (addon && addon.stock !== null && addon.stock !== undefined && next > addon.stock) {
        return prev;
      }
      if (next === 0) {
        const copy = { ...prev };
        delete copy[addonId];
        return copy;
      }
      return { ...prev, [addonId]: next };
    });
  }

  const addonsTotalCost = useMemo(() => {
    return Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
      const item = addonsList.find((a) => a.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [selectedAddons, addonsList]);

  const estimatedPrice = useMemo(() => {
    if (!selectedActivityData) return 0;

    const baseActivityPrice = activityPrice(selectedActivityData,duration);

    return baseActivityPrice + addonsTotalCost;
  }, [selectedActivityData, duration, addonsTotalCost]);

  const groupTotalPrice = useMemo(
    () => groupCart.reduce((sum, item) => sum + item.price, 0) + addonsTotalCost,
    [groupCart, addonsTotalCost]
  );

  function handleAddToGroupCart() {
    if (!selectedActivityData) return setError('Choose an activity.');
    if (!selectedResource) return setError('Choose a bay.');
    if (!startTime) return setError('Set a start time.');

    const hasTiered =
      selectedActivityData.halfHourPrice != null && selectedActivityData.fullHourPrice != null;
    if ((hasTiered || selectedActivityData.pricingUnit === 'PER_MINUTE') && duration < 30) {
      return setError('This activity needs at least 30 minutes.');
    }
    if (!hasTiered && selectedActivityData.pricingUnit === 'PER_HOUR' && duration < 60) {
      return setError('This activity needs at least 1 hour.');
    }

    const resObj = resources.find((r) => r.id === selectedResource);
    const newItem: AdminGroupCartItem = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      activityId: selectedActivityData.id,
      activityName: selectedActivityData.name,
      resourceId: selectedResource,
      resourceName: resObj?.name || 'Arena',
      date,
      startTime,
      duration,
      price: activityPrice(selectedActivityData,duration),
    };

    setGroupCart((prev) => [...prev, newItem]);
    setSelectedActivity('');
    setSelectedResource('');
    setError('');
  }

  function handleRemoveFromGroupCart(id: string) {
    setGroupCart((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (isGroupMode) {
      if (groupCart.length === 0) return setError('Add at least one activity to the group cart.');
      if (!customerName.trim()) return setError('Enter customer name.');
      if (!isCustomerPhoneValid) return setError('Enter a valid phone number.');

      setLoading(true);
      try {
        const items = groupCart.map((item) => {
          const startDateTime = businessInstant(item.date,item.startTime);
          const endDateTime = new Date(startDateTime);
          endDateTime.setMinutes(endDateTime.getMinutes() + item.duration);
          return {
            resourceId: item.resourceId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
          };
        });

        const formattedAddons = Object.entries(selectedAddons).map(([addonItemId, quantity]) => ({
          addonItemId,
          quantity
        }));

        await createGroupBooking({
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || undefined,
          },
          isWalkIn: true,
          paymentMethod,
          amountPaid: groupTotalPrice,
          screenshotBase64: screenshotBase64 || undefined,
          items,
          addons: formattedAddons.length > 0 ? formattedAddons : undefined,
        });

        setSuccess(true);
        setGroupCart([]);
        setSelectedAddons({});
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setPaymentMethod('CASH');
        setScreenshotBase64(null);
        setScreenshotPreview(null);

        setTimeout(() => router.push('/bookings'), 1500);
      } catch (err: any) {
        if (err.status === 409 || err.body?.itemIndex !== undefined) {
          setError(err.message || 'One of the selected bays has a time slot conflict.');
        } else {
          setError(err.message || 'Could not create the group booking');
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedActivityData) return setError('Choose an activity.');
    if (!selectedResource) return setError('Choose a bay.');
    if (!startTime) return setError('Set a start time.');

    const hasTiered =
      selectedActivityData.halfHourPrice != null && selectedActivityData.fullHourPrice != null;
    if ((hasTiered || selectedActivityData.pricingUnit === 'PER_MINUTE') && duration < 30) {
      return setError('This activity needs at least 30 minutes.');
    }
    if (!hasTiered && selectedActivityData.pricingUnit === 'PER_HOUR' && duration < 60) {
      return setError('This activity needs at least 1 hour.');
    }

    setLoading(true);

    try {
      const startDateTime = businessInstant(date,startTime);
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + duration);

      const formattedAddons = Object.entries(selectedAddons).map(([addonItemId, quantity]) => ({
        addonItemId,
        quantity
      }));

      await createBooking({
        resourceId: selectedResource,
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail || undefined,
        },
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        isWalkIn: true,
        paymentMethod,
        amountPaid: estimatedPrice,
        screenshotBase64: screenshotBase64 || undefined,
        addons: formattedAddons.length > 0 ? formattedAddons : undefined,
      });

      setSuccess(true);
      setSelectedActivity('');
      setSelectedResource('');
      setSelectedAddons({});
      setStartTime('');
      setDuration(60);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setPaymentMethod('CASH');
      setScreenshotBase64(null);
      setScreenshotPreview(null);

      setTimeout(() => router.push('/bookings'), 1500);
    } catch (err: any) {
      if (err.status === 409) {
        setError('That bay is already booked for this time. Pick another slot or bay.');
      } else {
        setError(err.message || 'Could not create the booking');
      }
    } finally {
      setLoading(false);
    }
  }

  const hasTiered =
    selectedActivityData?.halfHourPrice != null && selectedActivityData?.fullHourPrice != null;
  const minDuration = hasTiered || selectedActivityData?.pricingUnit === 'PER_MINUTE' ? 30 : 60;

  const isCustomerPhoneValid = !customerPhone.trim() ? false : isValidPakistaniPhone(customerPhone);
  const isCustomerEmailValid = !customerEmail.trim() ? true : isValidEmail(customerEmail);

  const isSingleFormValid =
    Boolean(selectedActivity) &&
    Boolean(selectedResource) &&
    Boolean(startTime) &&
    Boolean(customerName.trim()) &&
    isCustomerPhoneValid &&
    isCustomerEmailValid &&
    duration >= minDuration;

  const isGroupFormValid =
    groupCart.length > 0 &&
    Boolean(customerName.trim()) &&
    isCustomerPhoneValid &&
    isCustomerEmailValid;

  const isFormValid = isGroupMode ? isGroupFormValid : isSingleFormValid;

  const selectedResourceName = resources.find((r) => r.id === selectedResource)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-[22px] text-text">New Walk-In Booking</h1>
          <p className="text-[13px] text-muted">
            Counter booking - confirmed the moment you save it.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Group Booking Mode Toggle */}
          <div className="flex items-center bg-raised border border-line rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setIsGroupMode(false)}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-[12px] font-semibold transition-colors ${
                !isGroupMode
                  ? 'bg-brass text-ink shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              Single Activity
            </button>
            <button
              type="button"
              onClick={() => setIsGroupMode(true)}
              className={`px-3 py-1.5 min-h-[44px] rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition-colors ${
                isGroupMode
                  ? 'bg-brass text-ink shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              <span>Multi-Activity (Group)</span>
              {groupCart.length > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                  isGroupMode ? 'bg-ink text-brass' : 'bg-brass/20 text-brass'
                }`}>
                  {groupCart.length}
                </span>
              )}
            </button>
          </div>

          <button type="button" onClick={() => router.back()} className="btn btn-ghost min-h-[44px]">
            <Icon name="chevronLeft" size={14} />
            Back
          </button>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5">
          <Icon name="alert" size={14} className="mt-px" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-stop hover:text-text" aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </p>
      )}

      {success && (
        <p className="flex items-start gap-2 text-[12px] text-live bg-live/10 border border-live/35 rounded-[4px] px-3 py-2.5">
          <Icon name="check" size={14} className="mt-px" />
          <span>Booking confirmed. Taking you to the bookings list...</span>
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-5">
            <Step n={1} title="Activity">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {activities.map((activity) => {
                  const isSelected = selectedActivity === activity.id;
                  const tiered = activity.halfHourPrice != null && activity.fullHourPrice != null;

                  return (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => setSelectedActivity(activity.id)}
                      aria-pressed={isSelected}
                      className={`p-3.5 min-h-[44px] rounded-xl border text-left transition-colors ${
                        isSelected
                          ? 'bg-brass/10 border-brass'
                          : 'bg-raised border-line hover:border-brass-dim'
                      }`}
                    >
                      <span
                        className={`display block text-[16px] leading-tight ${
                          isSelected ? 'text-brass' : 'text-text'
                        }`}
                      >
                        {activity.name}
                      </span>
                      <span className="block mt-2.5 pt-2.5 border-t border-line tnum text-[12px] text-muted">
                        {tiered ? (
                          <>
                            Rs {activity.halfHourPrice}/30m · Rs {activity.fullHourPrice}/hr
                          </>
                        ) : (
                          <>
                            Rs {activity.basePrice}/{activity.pricingUnit === 'PER_HOUR' ? 'hr' : 'min'}
                          </>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Step>

            <Step n={2} title="Slot">
              <DateChipsSelector days={next7Days} selectedDate={date} onSelectDate={setDate} />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="start-time" className="field-label mb-0">
                    Start time
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const hours = String(now.getHours()).padStart(2, '0');
                      const minutes = String(Math.ceil(now.getMinutes() / 5) * 5 % 60).padStart(2, '0');
                      setStartTime(`${hours}:${minutes}`);
                    }}
                    className="text-[11px] min-h-[44px] text-brass hover:underline font-semibold flex items-center gap-1"
                  >
                    <Icon name="clock" size={13} />
                    <span>Set to Current Time</span>
                  </button>
                </div>
                <input
                  id="start-time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="field tnum text-[15px] font-semibold tracking-wider"
                />
                {startTime && (
                  <p className="mt-1 text-[11px] text-faint">
                    Selected slot start: <span className="text-text font-semibold">{startTime}</span>
                  </p>
                )}
              </div>

              <div>
                <p className="field-label">Bay</p>
                {!selectedActivity ? (
                  <p className="text-[12px] text-faint border border-dashed border-line rounded-[4px] px-3.5 py-4 text-center">
                    Pick an activity first.
                  </p>
                ) : resources.length === 0 ? (
                  <p className="text-[12px] text-wait border border-wait/35 bg-wait/8 rounded-[4px] px-3.5 py-4 text-center">
                    No bays set up for this activity.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {resources.map((resource) => {
                      const isSelected = selectedResource === resource.id;
                      return (
                        <button
                          key={resource.id}
                          type="button"
                          onClick={() => setSelectedResource(resource.id)}
                          aria-pressed={isSelected}
                          className={`px-3 py-2.5 min-h-[44px] rounded-xl border text-left text-[12px] transition-colors truncate ${
                            isSelected
                              ? 'bg-brass/10 border-brass text-brass font-semibold'
                              : 'bg-raised border-line text-muted hover:text-text hover:border-brass-dim'
                          }`}
                        >
                          {resource.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Step>

            {selectedActivityData && (
              <Step n={3} title="Duration">
                {hasTiered && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[30, 60, 90, 120, 180, 240].map((mins) => {
                      const totalHours = Math.floor(mins / 60);
                      const rem = mins % 60;
                      const slabPrice =
                        totalHours * selectedActivityData.fullHourPrice! +
                        (rem === 30 ? selectedActivityData.halfHourPrice! : 0);
                      const linearCost = (mins / 30) * selectedActivityData.halfHourPrice!;
                      const savings = linearCost - slabPrice;
                      const isSelected = duration === mins;

                      return (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDuration(mins)}
                          aria-pressed={isSelected}
                          className={`p-3 min-h-[44px] rounded-xl border text-left transition-colors ${
                            isSelected
                              ? 'bg-brass/10 border-brass'
                              : 'bg-raised border-line hover:border-brass-dim'
                          }`}
                        >
                          <span
                            className={`display block text-[15px] ${
                              isSelected ? 'text-brass' : 'text-text'
                            }`}
                          >
                            {mins >= 60 ? `${mins / 60} hr` : `${mins} min`}
                          </span>
                          <span className="flex items-baseline justify-between gap-2 mt-2 pt-2 border-t border-line">
                            <span className="tnum text-[13px] text-text">
                              Rs {slabPrice.toLocaleString()}
                            </span>
                            {savings > 0 && (
                              <span className="tnum text-[10px] text-live">
                                -Rs {savings.toLocaleString()}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!hasTiered && (
                  <>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                      {(selectedActivityData.pricingUnit === 'PER_HOUR'
                        ? [60, 90, 120, 180, 240]
                        : [30, 45, 60, 90, 120]
                      ).map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => setDuration(mins)}
                          aria-pressed={duration === mins}
                          className={`btn ${duration === mins ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'} py-2.5`}
                        >
                          {mins >= 60 && mins % 60 === 0 ? `${mins / 60} hr` : `${mins} min`}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label htmlFor="custom-duration" className="field-label">
                        Or set minutes - {minDuration} minimum
                      </label>
                      <div className="relative">
                        <input
                          id="custom-duration"
                          type="number"
                          min={minDuration}
                          step={selectedActivityData.pricingUnit === 'PER_HOUR' ? 15 : 5}
                          value={duration === 0 ? '' : duration}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setDuration(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          onBlur={() => {
                            if (duration < minDuration) setDuration(minDuration);
                          }}
                          className="field tnum pr-14"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-faint">
                          min
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* In Group Mode: Add To Group Button */}
                {isGroupMode && (
                  <div className="pt-4 border-t border-line mt-4">
                    <button
                      type="button"
                      onClick={handleAddToGroupCart}
                      disabled={!selectedActivity || !selectedResource || !startTime || duration < minDuration}
                      className="btn btn-secondary w-full min-h-[44px] py-3 flex items-center justify-center gap-2"
                    >
                      <Icon name="plus" size={15} />
                      <span>Add Activity to Group Cart (Rs {estimatedPrice.toLocaleString()})</span>
                    </button>
                  </div>
                )}
              </Step>
            )}

            {/* In Group Mode: Group Cart Items List */}
            {isGroupMode && (
              <Step title={`Group Activities Cart (${groupCart.length})`}>
                {groupCart.length === 0 ? (
                  <p className="text-[12px] text-faint border border-dashed border-line rounded-[4px] px-3.5 py-6 text-center">
                    No activities added to group yet. Select activity, slot & bay above and click &quot;Add Activity to Group Cart&quot;.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {groupCart.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-raised border border-line"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-brass/10 text-brass text-[11px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-[13px] text-text">
                              {item.activityName}
                            </span>
                            <span className="text-[11px] text-muted">({item.resourceName})</span>
                          </div>
                          <p className="text-[11px] text-faint ml-7">
                            ðŸ“… {item.date} · â° {item.startTime} ({item.duration} min)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-brass tnum text-[13px]">
                            Rs {item.price.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromGroupCart(item.id)}
                            className="text-muted hover:text-stop p-1 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
                            aria-label="Remove activity"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Step>
            )}

            {/* Optional Cafe & Snack Addons */}
            {addonsList.length > 0 && (
              <Step n={4} title="Cafe & Snack Add-ons (Optional)">
                <p className="text-xs text-muted mb-3">
                  Add drinks or snacks for the customer. Stock will automatically be adjusted.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                  {addonsList.map((addon) => {
                    const qty = selectedAddons[addon.id] || 0;
                    const isOutOfStock =
                      addon.stock !== null && addon.stock !== undefined && addon.stock <= 0;
                    const maxReached =
                      addon.stock !== null && addon.stock !== undefined && qty >= addon.stock;

                    return (
                      <div
                        key={addon.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          qty > 0
                            ? 'bg-brass/10 border-brass'
                            : 'bg-raised border-line hover:border-brass-dim'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-text truncate">
                              {addon.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-bold text-brass">
                              Rs {addon.price.toLocaleString()}
                            </span>
                            {addon.stock !== null && addon.stock !== undefined && (
                              <span className="text-[10px] text-faint">
                                ({addon.stock} left)
                              </span>
                            )}
                          </div>
                        </div>

                        {isOutOfStock ? (
                          <span className="text-[10px] font-semibold text-stop bg-stop/10 px-2 py-0.5 rounded">
                            Out of Stock
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-panel border border-line rounded-lg p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddonQtyChange(addon.id, -1)}
                              disabled={qty <= 0}
                              className="w-6 h-6 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-text hover:bg-raised disabled:opacity-30 cursor-pointer text-xs"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-bold text-text">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddonQtyChange(addon.id, 1)}
                              disabled={maxReached}
                              className="w-6 h-6 min-h-[44px] min-w-[44px] rounded flex items-center justify-center text-text hover:bg-raised disabled:opacity-30 cursor-pointer text-xs"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Step>
            )}
          </div>

          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-[76px]">
            <Step title="Customer">
              <div>
                <label htmlFor="cust-name" className="field-label">
                  Name
                </label>
                <input
                  id="cust-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onBlur={() => setCustomerTouched((t) => ({ ...t, name: true }))}
                  required
                  placeholder="Ali Khan"
                  className={`field transition-colors ${
                    customerTouched.name && !customerName.trim()
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {customerTouched.name && !customerName.trim() && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Customer name is required</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cust-phone" className="field-label">
                  Phone - used for the WhatsApp slip
                </label>
                <input
                  id="cust-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  onBlur={() => setCustomerTouched((t) => ({ ...t, phone: true }))}
                  required
                  placeholder="0300 1234567"
                  className={`field tnum transition-colors ${
                    customerTouched.phone && !isCustomerPhoneValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {customerTouched.phone && !isCustomerPhoneValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Enter a valid Pakistani mobile number (e.g. 0300 1234567)</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="cust-email" className="field-label">
                  Email - optional
                </label>
                <input
                  id="cust-email"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  onBlur={() => setCustomerTouched((t) => ({ ...t, email: true }))}
                  placeholder="ali@example.com"
                  className={`field transition-colors ${
                    customerTouched.email && !isCustomerEmailValid
                      ? 'border-stop focus:border-stop ring-1 ring-stop/20'
                      : ''
                  }`}
                />
                {customerTouched.email && !isCustomerEmailValid && (
                  <p className="text-[11px] text-stop mt-1 flex items-center gap-1">
                    <Icon name="alert" size={12} />
                    <span>Enter a valid email address</span>
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-line">
                <p className="field-label">How they paid</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('CASH');
                      setScreenshotBase64(null);
                      setScreenshotPreview(null);
                    }}
                    aria-pressed={paymentMethod === 'CASH'}
                    className={`btn py-2.5 ${paymentMethod === 'CASH' ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('ONLINE_EASYPAISA')}
                    aria-pressed={paymentMethod !== 'CASH'}
                    className={`btn py-2.5 ${paymentMethod !== 'CASH' ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                  >
                    Transfer
                  </button>
                </div>

                {paymentMethod !== 'CASH' && (
                  <div className="mt-3 bg-raised border border-line rounded-xl p-3.5 space-y-3">
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['ONLINE_EASYPAISA', 'ONLINE_JAZZCASH', 'ONLINE_BANK'] as PaymentMethod[]).map(
                        (m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            aria-pressed={paymentMethod === m}
                            className={`btn ${paymentMethod === m ? 'btn-primary min-h-[44px]' : 'btn-ghost min-h-[44px]'}`}
                          >
                            {m === 'ONLINE_EASYPAISA'
                              ? 'Easypaisa'
                              : m === 'ONLINE_JAZZCASH'
                              ? 'JazzCash'
                              : 'Bank'}
                          </button>
                        )
                      )}
                    </div>

                    <div>
                      <label htmlFor="receipt" className="field-label">
                        Receipt image - optional
                      </label>
                      <input
                        id="receipt"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            alert('Pick an image under 5 MB.');
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const res = reader.result as string;
                            setScreenshotBase64(res);
                            setScreenshotPreview(res);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="block w-full text-[12px] text-muted file:mr-2.5 file:py-1.5 file:px-3 file:rounded-[3px] file:border-0 file:text-[11px] file:font-semibold file:bg-brass file:text-ink hover:file:bg-brass-bright cursor-pointer"
                      />
                      {screenshotPreview && (
                        <div className="mt-2.5 relative inline-block">
                          <img
                            src={screenshotPreview}
                            alt="Receipt preview"
                            className="h-16 w-24 object-cover rounded-[3px] border border-line"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setScreenshotBase64(null);
                              setScreenshotPreview(null);
                            }}
                            className="absolute -top-2 -right-2 bg-raised border border-line rounded-full w-5 h-5 flex items-center justify-center text-muted hover:text-stop"
                            aria-label="Remove receipt"
                          >
                            <Icon name="close" size={11} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Step>

            <section className="panel p-5 space-y-4">
              {isGroupMode ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted text-[12px]">Activities in Group</span>
                    <span className="text-text font-semibold text-[13px]">{groupCart.length}</span>
                  </div>
                  {groupCart.length > 0 ? (
                    <div className="space-y-2 border-t border-line pt-2 text-[12px]">
                      {groupCart.map((item) => (
                        <div key={item.id} className="flex justify-between items-start">
                          <span className="text-faint truncate max-w-[140px]">{item.activityName}</span>
                          <span className="text-text tnum">Rs {item.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-faint border border-dashed border-line rounded p-2 text-center">
                      Cart empty
                    </p>
                  )}
                </div>
              ) : (
                <dl className="space-y-2 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Activity</dt>
                    <dd className="text-text text-right">
                      {selectedActivityData?.name || <span className="text-faint">-</span>}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Bay</dt>
                    <dd className="text-text text-right">
                      {selectedResourceName || <span className="text-faint">-</span>}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Starts</dt>
                    <dd className="text-text tnum text-right">
                      {startTime || <span className="text-faint">-</span>}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-faint">Runs for</dt>
                    <dd className="text-text tnum text-right">{duration} min</dd>
                  </div>
                  {addonsTotalCost > 0 && (
                    <div className="flex justify-between gap-3 pt-2 border-t border-line/60">
                      <dt className="text-brass">Cafe Add-ons</dt>
                      <dd className="text-brass tnum text-right font-semibold">
                        +Rs {addonsTotalCost.toLocaleString()}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {isGroupMode && addonsTotalCost > 0 && (
                <div className="flex justify-between items-center text-[12px] pt-2 border-t border-line">
                  <span className="text-brass font-medium">Cafe Add-ons Total</span>
                  <span className="text-brass font-bold tnum">+Rs {addonsTotalCost.toLocaleString()}</span>
                </div>
              )}

              <div className="pt-4 border-t border-line">
                <p className="eyebrow">To collect</p>
                <p className="display tnum text-[42px] text-text mt-1.5">
                  <span className="text-brass">Rs </span>
                  {(isGroupMode ? groupTotalPrice : estimatedPrice).toLocaleString()}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="btn btn-primary w-full min-h-[44px] py-3.5"
              >
                {loading ? <span className="spinner" /> : <Icon name="check" size={15} />}
                {loading ? 'Saving...' : isGroupMode ? `Confirm ${groupCart.length} Activities Group` : 'Confirm booking'}
              </button>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}


