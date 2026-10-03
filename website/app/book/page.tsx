'use client';

import { quote, money } from '@zeroone/domain';
import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getPricing,
  getAvailability,
  createBooking,
  createGroupBooking,
  uploadPaymentScreenshot,
  uploadGroupPaymentScreenshot,
  getPublicPaymentSettings,
  getActiveOffers,
  validatePromoCode,
  getAddons,
  type Activity,
  type ResourceAvailability,
  type BookingResponse,
  type BookingGroupResponse,
  type CreateGroupBookingResponse,
  type PublicPaymentSettings,
  type Offer,
  type AddonItem,
} from '@/lib/api';
import { isValidEmail, isValidPakistaniPhone } from '@/lib/validation';
import { formatTime12h, formatDateReadable, formatSlot12h, generateDayTimeSlots, getPKTDateTime, formatDateTimeRange, getNext7Days } from '@/lib/timeUtils';
import DateChipsSelector from '@/components/DateChipsSelector';
import { useCustomerAuth } from '@/context/CustomerAuthContext';
import { useSystemSettings } from '@/components/SystemStatusProvider';
import { Icon, type IconName } from '@/components/Icon';

const ACTIVITY_ICON_NAMES: Record<string, IconName> = {
  SNOOKER: 'snooker',
  PS5_OPEN: 'gamepad',
  PS5_PRIVATE: 'tv',
  CINEMA: 'clapperboard',
  TABLE_TENNIS: 'tableTennis',
  CAR_SIMULATOR: 'car',
};

const STORAGE_KEY = 'zeroone-booking-draft';

// ─── GROUP BOOKING TYPES ───
interface GroupCartItem {
  id: string;
  activityId: string;
  activityName: string;
  resourceType: string;
  date: string;
  timeSlot: string;
  resourceId: string;
  resourceName: string;
  duration: number;
  originalPrice: number;
  discountAmount: number;
  payablePrice: number;
  appliedOffer: Offer | null;
  promoCode: string;
}

function clearBookingDraft() {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

function getStoredDraft() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function BookingContent() {
  const searchParams = useSearchParams();
  const preSelectedActivityId = searchParams.get('activity');
  const promoParam = searchParams.get('promo');
  const offerIdParam = searchParams.get('offerId');
  const { customer, token } = useCustomerAuth();
  const { settings: systemSettings } = useSystemSettings();

  // Wizard Step (1: Activity -> 2: Date/Duration -> 3: Time Slot -> 4: Customer Details -> 5: Confirm -> 6: Payment / Held Slot -> 7: Awaiting Verification -> 8: Confirmed Slip)
  const [step, setStep] = useState<number>(1);

  // Form State
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [duration, setDuration] = useState<number>(60); // Duration in minutes for PER_MINUTE & PER_HOUR
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(''); // "HH:mm"
  const [selectedResourceId, setSelectedResourceId] = useState<string>('');

  // Customer State - Autofill if customer is logged in
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(customer?.email || '');
  const [customerTouched, setCustomerTouched] = useState({ name: false, phone: false, email: false });

  // Flag to know when draft has been restored from sessionStorage on initial mount
  const [isDraftHydrated, setIsDraftHydrated] = useState(false);
  const [prevActivityId, setPrevActivityId] = useState<string>('');

  const isCustomerPhoneValid = !customerPhone.trim() ? false : isValidPakistaniPhone(customerPhone);
  const isCustomerEmailValid = !customerEmail.trim() ? true : isValidEmail(customerEmail);
  const isCustomerFormValid = customerName.trim().length > 0 && isCustomerPhoneValid && isCustomerEmailValid;

  useEffect(() => {
    if (customer) {
      if (customer.name && !customerName) setCustomerName(customer.name);
      if (customer.phone && !customerPhone) setCustomerPhone(customer.phone);
      if (customer.email && !customerEmail) setCustomerEmail(customer.email);
    }
  }, [customer]);

  // Deals & Promo State
  const [activeOffers, setActiveOffers] = useState<Offer[]>([]);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedOffer, setAppliedOffer] = useState<Offer | null>(null);
  const [promoStatus, setPromoStatus] = useState<{ loading: boolean; error?: string; success?: string }>({ loading: false });

  // Availability & Submission State
  const [resourcesAvailability, setResourcesAvailability] = useState<ResourceAvailability[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);

  // Payment Verification State (Step 6)
  const [paymentSettings, setPaymentSettings] = useState<PublicPaymentSettings | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadingPayment, setUploadingPayment] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'ONLINE_EASYPAISA' | 'ONLINE_JAZZCASH' | 'ONLINE_BANK'>('ONLINE_EASYPAISA');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes in seconds
  const [isExpired, setIsExpired] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ─── GROUP BOOKING MODE ───
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [groupCart, setGroupCart] = useState<GroupCartItem[]>([]);
  const [confirmedGroupBooking, setConfirmedGroupBooking] = useState<CreateGroupBookingResponse | null>(null);

  // ─── ADDONS STATE ───
  const [addonsList, setAddonsList] = useState<AddonItem[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});

  // 7-Day Window Date Chips Source
  const next7Days = useMemo(() => getNext7Days(), []);

  // Hydrate draft from sessionStorage once on mount
  useEffect(() => {
    const draft = getStoredDraft();
    if (draft) {
      if (draft.step && typeof draft.step === 'number' && draft.step >= 1 && draft.step <= 6) {
        setStep(draft.step);
      }
      if (draft.selectedActivityId) {
        setSelectedActivityId(draft.selectedActivityId);
        setPrevActivityId(draft.selectedActivityId);
      }
      if (draft.selectedDate) setSelectedDate(draft.selectedDate);
      if (draft.duration) setDuration(draft.duration);
      if (draft.selectedTimeSlot) setSelectedTimeSlot(draft.selectedTimeSlot);
      if (draft.selectedResourceId) setSelectedResourceId(draft.selectedResourceId);
      if (draft.isGroupMode) setIsGroupMode(true);
      if (Array.isArray(draft.groupCart)) setGroupCart(draft.groupCart);
      if (draft.confirmedGroupBooking) setConfirmedGroupBooking(draft.confirmedGroupBooking);
      if (draft.selectedAddons) setSelectedAddons(draft.selectedAddons);
      if (draft.customerName) setCustomerName(draft.customerName);
      if (draft.customerPhone) setCustomerPhone(draft.customerPhone);
      if (draft.customerEmail) setCustomerEmail(draft.customerEmail);
      if (draft.appliedOffer) setAppliedOffer(draft.appliedOffer);
      if (draft.promoCodeInput) setPromoCodeInput(draft.promoCodeInput);
      if (draft.confirmedBooking) {
        setConfirmedBooking(draft.confirmedBooking);
      }
    }
    setIsDraftHydrated(true);
  }, []);

  // Save changes to sessionStorage whenever relevant booking state changes
  useEffect(() => {
    if (!isDraftHydrated) return;

    // If booking reached review / slip screens (7 or 8), draft is completed
    if (step >= 7) {
      clearBookingDraft();
      return;
    }

    try {
      const draftData = {
        step,
        selectedActivityId,
        selectedDate,
        duration,
        selectedTimeSlot,
        selectedResourceId,
        customerName,
        customerPhone,
        customerEmail,
        appliedOffer,
        promoCodeInput,
        confirmedBooking,
        isGroupMode,groupCart,confirmedGroupBooking,selectedAddons,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draftData));
    } catch {
      // Storage quota or disabled fallback
    }
  }, [
    isDraftHydrated,
    step,
    selectedActivityId,
    selectedDate,
    duration,
    selectedTimeSlot,
    selectedResourceId,
    customerName,
    customerPhone,
    customerEmail,
    appliedOffer,
    promoCodeInput,
    confirmedBooking,isGroupMode,groupCart,confirmedGroupBooking,selectedAddons,
  ]);

  // 1. Fetch available activities and active deals
  const loadAddonsList = async () => {
    setLoadingAddons(true);
    try {
      const data = await getAddons();
      setAddonsList(data.filter((item) => item.isAvailable));
    } catch (e) {
      console.error('Failed to load addons:', e);
    } finally {
      setLoadingAddons(false);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        setLoadingActivities(true);
        const [data, offersData] = await Promise.all([
          getPricing(),
          getActiveOffers().catch(() => [])
        ]);
        setActivities(data);
        setActiveOffers(offersData);

        // Preselect default date (today) strictly from next7Days source if not already set or restored
        const days = getNext7Days();
        setSelectedDate((prev) => prev || (days.length > 0 ? days[0].dateStr : ''));

        // Auto-detect and pre-apply promo code or offer from URL
        let matchedOffer: Offer | null = null;
        if (promoParam) {
          const code = promoParam.trim().toUpperCase();
          setPromoCodeInput(code);
          matchedOffer = offersData.find((o: Offer) => o.promoCode && o.promoCode.toUpperCase() === code) || null;
        } else if (offerIdParam) {
          matchedOffer = offersData.find((o: Offer) => o.id === offerIdParam) || null;
          if (matchedOffer?.promoCode) {
            setPromoCodeInput(matchedOffer.promoCode.toUpperCase());
          }
        }

        if (matchedOffer) {
          setAppliedOffer(matchedOffer);
          setPromoStatus({
            loading: false,
            success: `Deal Auto-Applied: ${matchedOffer.title} (${
              matchedOffer.discountType === 'PERCENTAGE'
                ? `${matchedOffer.discountValue}% OFF`
                : `₨${matchedOffer.discountValue} OFF`
            })`,
          });

          // If offer is tied to a specific activity and no activity was explicitly given, preselect it
          if (!preSelectedActivityId && matchedOffer.activityId) {
            const matchedAct = data.find((a: Activity) => a.id === matchedOffer?.activityId);
            if (matchedAct) {
              setSelectedActivityId((prev) => prev || matchedAct.id);
              setStep((prev) => (prev === 1 ? 2 : prev));
            }
          }
        }

        if (preSelectedActivityId) {
          const match = data.find((a: Activity) => a.id === preSelectedActivityId);
          if (match) {
            setSelectedActivityId(match.id);
            setStep((prev) => (prev === 1 ? 2 : prev));
          }
        }
      } catch (err: any) {
        setErrorMessage('Failed to load activities: ' + err.message);
      } finally {
        setLoadingActivities(false);
      }
    }
    load();
    loadAddonsList();
  }, [preSelectedActivityId, promoParam, offerIdParam]);



  const currentActivity = useMemo(() => {
    return activities.find((a) => a.id === selectedActivityId);
  }, [activities, selectedActivityId]);

  // Set default duration only when user explicitly switches to a DIFFERENT activity
  useEffect(() => {
    if (!currentActivity) return;

    if (prevActivityId && prevActivityId !== currentActivity.id) {
      // Activity actually changed by user click
      if (currentActivity.halfHourPrice != null && currentActivity.fullHourPrice != null) {
        setDuration(30);
      } else if (currentActivity.pricingUnit === 'PER_MINUTE') {
        setDuration(30);
      } else {
        setDuration(60);
      }
      setSelectedTimeSlot('');
      setSelectedResourceId('');
    } else if (!prevActivityId) {
      // First initialization of activity
      setPrevActivityId(currentActivity.id);
    }
  }, [currentActivity, prevActivityId]);

  // 2. Fetch resource availability when Activity or Date changes
  const fetchSlotAvailability = async () => {
    if (!currentActivity || !selectedDate) return;
    setLoadingAvailability(true);
    setErrorMessage('');
    try {
      const data = await getAvailability(selectedDate, currentActivity.resourceType);
      setResourcesAvailability(data.resources);
      if (data.serverTime) {
        setServerTimestamp(data.serverTime);
      }
    } catch (err: any) {
      setErrorMessage('Failed to load availability: ' + err.message);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    if (step === 3 && currentActivity) {
      fetchSlotAvailability();
    }
  }, [step, selectedDate, currentActivity]);

  // Calculate start and end Date objects for a given slot string "HH:mm" in Pakistan Standard Time (UTC+5)
  const calculateSlotTimes = (timeStr: string) => {
    if (!selectedDate || !timeStr || !currentActivity) return null;

    const start = getPKTDateTime(selectedDate, timeStr);
    const end = new Date(start);

    // Duration is in minutes across all activity types
    end.setMinutes(end.getMinutes() + duration);

    return { start, end };
  };

  // 24/7 Granular slot evaluation with exact timestamp overlap check & strict past time filtering
  const availableSlotsList = useMemo(() => {
    if (!currentActivity || !resourcesAvailability.length) return [];

    // Use fresh server timestamp if returned by API, otherwise current Date
    const currentTime = serverTimestamp ? new Date(serverTimestamp) : new Date();

    // 15-minute granularity for all activities
    const intervalMinutes = 15;
    const slotOptions = generateDayTimeSlots(selectedDate, currentTime, intervalMinutes);

    return slotOptions
      .map((timeStr) => {
        const times = calculateSlotTimes(timeStr);
        if (!times) return null;

        // Strict Past Slot Filter: If slot start time is in the past (<= current time), completely hide it
        if (times.start <= currentTime) {
          return null;
        }

        // Check which resource is free during this entire duration window [start, end]
        // Canonical Overlap Formula: (existing.startTime < new.endTime) && (existing.endTime > new.startTime)
        const freeResource = resourcesAvailability.find((resource) => {
          const hasConflict = resource.busySlots.some((slot: { startTime: string; endTime: string }) => {
            const bookingStart = new Date(slot.startTime);
            const bookingEnd = new Date(slot.endTime);

            return bookingStart < times.end && bookingEnd > times.start;
          });
          return !hasConflict;
        });

        return {
          timeStr,
          display12h: formatSlot12h(timeStr),
          available: !!freeResource,
          freeResourceId: freeResource ? freeResource.id : null,
        };
      })
      .filter((slot): slot is { timeStr: string; display12h: string; available: boolean; freeResourceId: string | null } => slot !== null);
  }, [currentActivity, resourcesAvailability, duration, selectedDate, serverTimestamp]);

  // Auto-apply eligible public offers (offers without promo codes)
  useEffect(() => {
    if (!currentActivity || promoCodeInput.trim() !== '') return;

    // Check if there is an automatic public offer matching this activity and duration
    const matchingOffer = activeOffers.find((offer) => {
      if (offer.promoCode) return false; // skip promo-code specific offers
      if (offer.applicableTo === 'SPECIFIC_ACTIVITY' && offer.activityId && offer.activityId !== currentActivity.id) {
        return false;
      }
      if (offer.minDuration && duration < offer.minDuration) {
        return false;
      }
      return true;
    });

    if (matchingOffer) {
      setAppliedOffer(matchingOffer);
    } else if (!offerIdParam && !promoParam) {
      setAppliedOffer(null);
    }
  }, [currentActivity, duration, activeOffers, promoCodeInput, offerIdParam, promoParam]);

  // Handle manual Promo Code validation
  const handleApplyPromoCode = async () => {
    if (!promoCodeInput.trim()) return;
    setPromoStatus({ loading: true });
    try {
      const res = await validatePromoCode({
        promoCode: promoCodeInput.trim().toUpperCase(),
        activityId: currentActivity?.id,
        durationMinutes: duration,
      });

      if (res.valid && res.offer) {
        setAppliedOffer(res.offer);
        setPromoStatus({
          loading: false,
          success: `Deal Applied: ${res.offer.title} (${res.offer.discountType === 'PERCENTAGE' ? `${res.offer.discountValue}% OFF` : `Rs ${res.offer.discountValue} OFF`})`
        });
      } else {
        setAppliedOffer(null);
        setPromoStatus({ loading: false, error: res.error || 'Invalid or expired promo code.' });
      }
    } catch (err: any) {
      setAppliedOffer(null);
      setPromoStatus({ loading: false, error: err.message || 'Failed to validate promo code.' });
    }
  };

  // Calculate Total Price and Discounts
  const { originalPrice, discountAmount, payablePrice } = useMemo(() => {
    if (!currentActivity) return { originalPrice: 0, discountAmount: 0, payablePrice: 0 };

    return quote(currentActivity,duration,appliedOffer);
  }, [currentActivity, duration, appliedOffer]);

  const handleAddonQtyChange = (addonId: string, delta: number) => {
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
  };

  const addonsTotalCost = useMemo(() => {
    return Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
      const item = addonsList.find((a) => a.id === id);
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }, [selectedAddons, addonsList]);

  const totalPrice = payablePrice + addonsTotalCost;

  // 15-Minute Countdown timer for Step 6
  useEffect(() => {
    if (step === 6 && (confirmedBooking || confirmedGroupBooking)) {
      const createdTime = new Date(
        confirmedBooking ? confirmedBooking.createdAt : confirmedGroupBooking!.group.createdAt
      ).getTime();
      const expiryTime = createdTime + 15 * 60 * 1000;

      const interval = setInterval(() => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
        setTimeLeft(diff);
        if (diff <= 0) {
          setIsExpired(true);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, confirmedBooking, confirmedGroupBooking]);

  // Load public payment settings
  useEffect(() => {
    if (step === 6) {
      getPublicPaymentSettings()
        .then((data) => setPaymentSettings(data))
        .catch((err) => console.error('Failed to load payment settings:', err));
    }
  }, [step]);

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const handleUploadPayment = async () => {
    if (!confirmedBooking || !filePreview) return;
    setUploadingPayment(true);
    setErrorMessage('');

    try {
      const parsedAmount = amountPaidInput ? parseFloat(amountPaidInput) : confirmedBooking.totalPrice;
      const updated = await uploadPaymentScreenshot(
        confirmedBooking.id,
        filePreview,
        selectedFile?.name,
        selectedPaymentMethod,
        parsedAmount
      );
      setConfirmedBooking(updated);
      setStep(7); // Advance to Awaiting Verification screen
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload screenshot. Please try again.');
    } finally {
      setUploadingPayment(false);
    }
  };

  // Step 5: Submit booking (Creates 15-min held booking)
  const handleConfirmBooking = async () => {
    if (!selectedResourceId || !currentActivity || !selectedTimeSlot) {
      setErrorMessage('Missing required booking details.');
      return;
    }

    if (systemSettings && !systemSettings.bookingsEnabled) {
      setErrorMessage(systemSettings.bookingsPausedMessage || 'Online bookings are temporarily paused. Please call us directly.');
      return;
    }

    if (systemSettings && systemSettings.emergencyClosedToday) {
      setErrorMessage(systemSettings.emergencyClosedMessage || 'Facility is closed today.');
      return;
    }

    const times = calculateSlotTimes(selectedTimeSlot);
    if (!times) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      const formattedAddons = Object.entries(selectedAddons).map(([addonItemId, quantity]) => ({
        addonItemId,
        quantity
      }));

      const response = await createBooking(
        {
          resourceId: selectedResourceId,
          customer: {
            name: customerName,
            phone: customerPhone,
            email: customerEmail || undefined,
          },
          startTime: times.start.toISOString(),
          endTime: times.end.toISOString(),
          isWalkIn: false,
          promoCode: appliedOffer?.promoCode || undefined,
          offerId: appliedOffer?.id || undefined,
          addons: formattedAddons.length > 0 ? formattedAddons : undefined,
        },
        token
      );

      setConfirmedBooking(response);
      setStep(6); // Go to Payment Step
    } catch (err: any) {
      if (err.status === 409) {
        setErrorMessage(
          'This time slot was just booked by another customer! Please choose another slot.'
        );
        // Refresh availability and jump back to step 3
        await fetchSlotAvailability();
        setStep(3);
      } else {
        setErrorMessage(err.message || 'Failed to confirm booking. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formattedSlotTime = useMemo(() => {
    if (!selectedTimeSlot || !currentActivity) return '';
    const times = calculateSlotTimes(selectedTimeSlot);
    if (!times) return '';
    return formatDateTimeRange(times.start, times.end);
  }, [selectedTimeSlot, currentActivity, duration, selectedDate]);

  // ─── GROUP BOOKING HELPERS ───
  const groupTotalPrice = useMemo(() => money(groupCart.reduce((sum, item) => sum + item.payablePrice, 0)+addonsTotalCost), [groupCart,addonsTotalCost]);

  const addToGroupCart = () => {
    if (!currentActivity || !selectedTimeSlot || !selectedResourceId) return;
    const resource = resourcesAvailability.find(r => r.id === selectedResourceId);
    const newItem: GroupCartItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      activityId: currentActivity.id,
      activityName: currentActivity.name,
      resourceType: currentActivity.resourceType,
      date: selectedDate,
      timeSlot: selectedTimeSlot,
      resourceId: selectedResourceId,
      resourceName: resource?.name || 'Arena',
      duration,
      originalPrice,
      discountAmount,
      payablePrice,
      appliedOffer: appliedOffer,
      promoCode: promoCodeInput,
    };
    setGroupCart(prev => [...prev, newItem]);
    // Reset for next item
    setSelectedActivityId('');
    setPrevActivityId('');
    setSelectedTimeSlot('');
    setSelectedResourceId('');
    setAppliedOffer(null);
    setPromoCodeInput('');
    setPromoStatus({ loading: false });
    setStep(1);
  };

  const removeFromGroupCart = (itemId: string) => {
    setGroupCart(prev => prev.filter(item => item.id !== itemId));
  };

  const handleConfirmGroupBooking = async () => {
    if (groupCart.length === 0) return;

    if (systemSettings && !systemSettings.bookingsEnabled) {
      setErrorMessage(systemSettings.bookingsPausedMessage || 'Online bookings are temporarily paused. Please call us directly.');
      return;
    }

    if (systemSettings && systemSettings.emergencyClosedToday) {
      setErrorMessage(systemSettings.emergencyClosedMessage || 'Facility is closed today.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const response = await createGroupBooking({
        customer: {
          name: customerName,
          phone: customerPhone,
          email: customerEmail || undefined,
        },
        isWalkIn: false,
        addons:Object.entries(selectedAddons).map(([addonItemId,quantity])=>({addonItemId,quantity})),
        items: groupCart.map(item => {
          const startDt = getPKTDateTime(item.date, item.timeSlot);
          const endDt = new Date(startDt);
          endDt.setMinutes(endDt.getMinutes() + item.duration);
          return {
            resourceId: item.resourceId,
            startTime: startDt.toISOString(),
            endTime: endDt.toISOString(),
            promoCode: item.promoCode || null,
            offerId: item.appliedOffer?.id || null,
          };
        }),
      }, token);
      setConfirmedGroupBooking(response);
      setStep(6);
    } catch (err: any) {
      if (err.body?.itemIndex !== undefined) {
        setErrorMessage(`Activity #${err.body.itemIndex + 1} (${groupCart[err.body.itemIndex]?.activityName}): ${err.message}`);
      } else {
        setErrorMessage(err.message || 'Failed to create group booking.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadGroupPayment = async () => {
    if (!confirmedGroupBooking || !filePreview) return;
    setUploadingPayment(true);
    setErrorMessage('');
    try {
      const parsedAmount = amountPaidInput ? parseFloat(amountPaidInput) : confirmedGroupBooking.totalAmount;
      await uploadGroupPaymentScreenshot(
        confirmedGroupBooking.group.id,
        filePreview,
        selectedFile?.name,
        selectedPaymentMethod,
        parsedAmount
      );
      setStep(7);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload screenshot.');
    } finally {
      setUploadingPayment(false);
    }
  };

  return (
    <div className="zo-page-container zo-page-spacing">
      {/* ONLINE BOOKINGS PAUSED — ENTIRE BOOKING FLOW BLOCKED */}
      {systemSettings && !systemSettings.bookingsEnabled && step <= 5 ? (
        <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-8 rounded-3xl zo-panel bg-brand-surface border border-amber-500/30 text-brand-text-main shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-inner">
            <Icon name="pause" size={28} />
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-white font-display">
              Online Bookings Paused
            </h1>
            <p className="text-sm sm:text-base text-brand-text-muted leading-relaxed">
              {systemSettings.bookingsPausedMessage ||
                'Online bookings are temporarily paused. Please call or visit us directly to book your slot.'}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <a
              href={`tel:${(systemSettings.contactPhone || '+92 300 1234567').replace(/\s+/g, '')}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-ink font-bold text-sm uppercase tracking-wider shadow-lg transition-all"
            >
              <Icon name="phone" size={16} />
              <span>Call Venue Directly ({systemSettings.contactPhone || '+92 300 1234567'})</span>
            </a>
            <Link
              href="/"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-brand-bg hover:bg-brand-card border border-brand-border text-brand-text-muted hover:text-white font-semibold text-sm transition-all"
            >
              Explore Activities
            </Link>
          </div>

          <p className="text-xs text-brand-text-muted/60 font-mono">
            Walk-in slots and physical arena access remain active.
          </p>
        </div>
      ) : systemSettings && systemSettings.emergencyClosedToday && step <= 5 ? (
        <div className="min-h-[55vh] flex flex-col items-center justify-center text-center p-8 rounded-3xl zo-panel bg-brand-surface border border-rose-500/30 text-brand-text-main shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shadow-inner">
            <Icon name="siren" size={28} />
          </div>
          <div className="space-y-3 max-w-md mx-auto">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-white font-display">
              Venue Closed Today
            </h1>
            <p className="text-sm sm:text-base text-brand-text-muted leading-relaxed">
              {systemSettings.emergencyClosedMessage ||
                'We are closed for today due to a private event or maintenance. Normal operations resume tomorrow.'}
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary-hover text-white font-bold text-sm shadow-lg transition-all"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Wizard Progress Stepper */}
      {step <= 5 && (
        <div className="mb-10">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-brand-border -z-10" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-primary -z-10 transition-all duration-300"
              style={{ width: `${((step - 1) / 4) * 100}%` }}
            />
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold border-2 transition-all ${
                  step === s
                    ? 'border-brand-primary zo-solid-accent bg-brand-primary text-white shadow-lg shadow-brand-primary/30 scale-110'
                    : step > s
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-brand-border bg-brand-surface text-brand-text-muted'
                }`}
              >
                {step > s ? <Icon name="check" size={14} /> : s}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] sm:text-xs text-brand-text-muted mt-2 font-medium">
            <span>Activity</span>
            <span>Date & Duration</span>
            <span>Time Slots</span>
            <span>Contact Info</span>
            <span>Confirm</span>
          </div>
        </div>
      )}

      {/* Global Error Banner */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-sm flex items-start gap-3">
          <Icon name="alert" size={18} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1">{errorMessage}</div>
        </div>
      )}

      {/* Applied Deal Banner */}
      {appliedOffer && step <= 5 && (
        <div className="mb-6 p-4 rounded-2xl bg-brand-primary/10 border border-brand-accent/40 text-brand-text-main flex items-center justify-between gap-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-accent/20 text-brand-accent">
              <Icon name="flame" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-brand-accent tracking-widest">
                  Active Mission Deal
                </span>
                <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[10px] font-bold px-2 py-0.5 rounded">
                  {appliedOffer.discountType === 'PERCENTAGE'
                    ? `${appliedOffer.discountValue}% OFF`
                    : `₨${appliedOffer.discountValue} OFF`}
                </span>
              </div>
              <p className="text-sm font-black text-brand-text-main mt-0.5">{appliedOffer.title}</p>
            </div>
          </div>
          <div className="text-right text-xs text-emerald-400 font-bold hidden sm:flex items-center gap-1">
            <Icon name="check" size={13} />
            <span>Auto-Applied at Checkout</span>
          </div>
        </div>
      )}

      {/* STEP 1: Select Activity */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-extrabold text-brand-text-main">Select an Arena</h1>
            <p className="text-brand-text-muted text-sm">Choose what game or suite you would like to book</p>
          </div>

          {loadingActivities ? (
            <div className="p-12 text-center text-brand-text-muted">Loading activities...</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.map((activity) => {
                const isSelected = selectedActivityId === activity.id;
                const iconName = ACTIVITY_ICON_NAMES[activity.resourceType] || 'target';
                const isHourly = activity.pricingUnit === 'PER_HOUR';
                const hasTiered = activity.halfHourPrice != null && activity.fullHourPrice != null;
                const isOfferEligible = appliedOffer && (appliedOffer.applicableTo === 'ALL_ACTIVITIES' || appliedOffer.activityId === activity.id);

                return (
                  <button
                    key={activity.id}
                    type="button"
                    onClick={() => setSelectedActivityId(activity.id)}
                    className={`p-5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-brand-primary/10 border-brand-primary shadow-lg shadow-brand-primary/20 ring-1 ring-brand-primary'
                        : isOfferEligible
                        ? 'bg-brand-surface border-brand-accent/50 hover:border-brand-accent hover:bg-brand-card'
                        : 'bg-brand-surface border-brand-border hover:border-brand-border-light hover:bg-brand-card'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-brand-bg border border-brand-border text-brand-primary">
                        <Icon name={iconName} size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-brand-text-main text-base">{activity.name}</div>
                          {isOfferEligible && (
                            <span className="bg-brand-accent/15 text-brand-accent text-[9px] font-bold px-1.5 py-0.5 rounded border border-brand-accent/30">
                              DEAL
                            </span>
                          )}
                        </div>
                        {hasTiered ? (
                          <div className="text-xs text-emerald-400 mt-0.5 font-medium">
                            ₨{activity.halfHourPrice} /30m • ₨{activity.fullHourPrice} /1h
                          </div>
                        ) : (
                          <div className="text-xs text-brand-text-muted mt-0.5">
                            ₨{activity.basePrice} /{isHourly ? 'hour' : 'min'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected
                          ? 'border-brand-primary bg-brand-primary text-white text-xs'
                          : 'border-brand-border'
                      }`}
                    >
                      {isSelected && <Icon name="check" size={12} />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Group Booking Toggle */}
          <div className="mt-4 p-4 rounded-2xl bg-brand-bg border border-brand-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-primary/10 text-brand-primary">
                <Icon name="layers" size={22} />
              </div>
              <div>
                <span className="text-sm font-bold text-brand-text-main block">Book Multiple Activities (Group Cart)</span>
                <span className="text-xs text-brand-text-muted">Select multiple arenas & slots — single checkout & single receipt</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsGroupMode(!isGroupMode);
                if (isGroupMode) {
                  setGroupCart([]);
                  setConfirmedGroupBooking(null);
                }
              }}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${isGroupMode ? 'bg-brand-primary' : 'bg-brand-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${isGroupMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Group Cart In-Step Summary when Group Mode is ON and items are present */}
          {isGroupMode && groupCart.length > 0 && (
            <div className="p-5 rounded-2xl bg-brand-surface border-2 border-brand-primary/40 space-y-4 shadow-xl shadow-brand-primary/5">
              <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
                    {groupCart.length} {groupCart.length === 1 ? 'Activity' : 'Activities'} in Cart
                  </span>
                  <span className="text-xs text-brand-text-muted hidden sm:inline">
                    Choose another arena below or proceed to checkout
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupCart([])}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
                >
                  <Icon name="trash" size={13} />
                  <span>Clear All</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groupCart.map((item, idx) => {
                  const itemStart = getPKTDateTime(item.date, item.timeSlot);
                  const itemEnd = new Date(itemStart);
                  itemEnd.setMinutes(itemEnd.getMinutes() + item.duration);

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-between gap-3 group hover:border-brand-primary/40 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-brand-surface border border-brand-border text-brand-primary shrink-0">
                          <Icon name={ACTIVITY_ICON_NAMES[item.resourceType] || 'target'} size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-brand-text-main truncate">
                              {idx + 1}. {item.activityName}
                            </span>
                          </div>
                          <span className="text-[11px] text-brand-text-muted block truncate">
                            {formatDateReadable(item.date)} • {formatDateTimeRange(itemStart, itemEnd)}
                          </span>
                          <span className="text-[11px] text-brand-accent font-medium block">
                            {item.duration}m ({item.resourceName})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-black text-emerald-400">
                          ₨{item.payablePrice.toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromGroupCart(item.id)}
                          title="Remove activity"
                          className="p-1.5 rounded-lg text-brand-text-muted hover:text-red-400 hover:bg-red-950/40 transition-all"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-brand-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-brand-text-muted font-medium">Group Subtotal:</span>
                  <span className="text-lg font-black text-brand-primary">₨{groupTotalPrice.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-95 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span>Proceed to Contact Details ({groupCart.length} {groupCart.length === 1 ? 'Item' : 'Items'})</span>
                  <Icon name="check" size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            {isGroupMode && groupCart.length > 0 ? (
              <span className="text-xs text-brand-text-muted">
                {selectedActivityId
                  ? 'Click continue below to configure date & time for the selected arena'
                  : 'Select an arena above to add another activity to your group'}
              </span>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              {isGroupMode && groupCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 hover:bg-emerald-900/50 transition-all"
                >
                  Checkout {groupCart.length} {groupCart.length === 1 ? 'Activity' : 'Activities'} (₨{groupTotalPrice.toLocaleString()}) →
                </button>
              )}

              <button
                type="button"
                disabled={!selectedActivityId}
                onClick={() => setStep(2)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/25 active:scale-95 transition-all"
              >
                {isGroupMode && groupCart.length > 0 ? 'Configure Selected Arena →' : 'Continue to Date & Duration →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Select Date & Duration */}
      {step === 2 && currentActivity && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-extrabold text-brand-text-main">Date & Duration</h1>
            <p className="text-brand-text-muted text-sm">
              {currentActivity.name} • ₨{currentActivity.basePrice}/{currentActivity.pricingUnit === 'PER_HOUR' ? 'hr' : 'min'}
            </p>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8 space-y-6">
            {/* 7-Day Locked Date Chip Selection */}
            <DateChipsSelector
              days={next7Days}
              selectedDate={selectedDate}
              onSelectDate={(newDate) => {
                setSelectedDate(newDate);
                setSelectedTimeSlot('');
                setSelectedResourceId('');
              }}
              theme="dark"
            />

            {/* Duration Selector */}
            <div>
              {(() => {
                // Tiered / Slab Pricing Activity (e.g. Car Simulator)
                if (
                  currentActivity.halfHourPrice != null &&
                  currentActivity.fullHourPrice != null
                ) {
                  const halfPrice = currentActivity.halfHourPrice;
                  const fullPrice = currentActivity.fullHourPrice;

                  const slabs = [
                    { mins: 30, label: '30 Minutes', hoursLabel: '0.5 hr' },
                    { mins: 60, label: '1 Hour', hoursLabel: '1.0 hr' },
                    { mins: 90, label: '1.5 Hours', hoursLabel: '1.5 hrs' },
                    { mins: 120, label: '2 Hours', hoursLabel: '2.0 hrs' },
                    { mins: 180, label: '3 Hours', hoursLabel: '3.0 hrs' },
                    { mins: 240, label: '4 Hours', hoursLabel: '4.0 hrs' },
                  ];

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                          Select Duration (Special Tiered Rates)
                        </label>
                        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Icon name="sparkles" size={12} />
                          <span>Discount Slabs Active</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {slabs.map((slab) => {
                          const totalHours = Math.floor(slab.mins / 60);
                          const rem = slab.mins % 60;
                          const slabPrice = totalHours * fullPrice + (rem === 30 ? halfPrice : 0);
                          const linearCost = (slab.mins / 30) * halfPrice;
                          const savings = linearCost - slabPrice;
                          const isSelected = duration === slab.mins;

                          return (
                            <button
                              key={slab.mins}
                              type="button"
                              onClick={() => setDuration(slab.mins)}
                              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                                isSelected
                                  ? 'zo-solid-accent bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/30 scale-[1.02]'
                                  : 'bg-brand-bg border-brand-border text-brand-text-muted hover:border-brand-border-light hover:bg-brand-card hover:text-brand-text-main'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-brand-text-main">{slab.label}</span>
                                <span
                                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                                    isSelected
                                      ? 'bg-black/30 text-white'
                                      : 'bg-brand-surface text-brand-text-muted'
                                  }`}
                                >
                                  {slab.hoursLabel}
                                </span>
                              </div>

                              <div className="mt-2.5 pt-2 border-t border-white/10 flex items-baseline justify-between">
                                <span className={`text-base font-black ${isSelected ? 'text-white' : 'text-emerald-400'}`}>
                                  ₨{slabPrice.toLocaleString()}
                                </span>
                                {savings > 0 ? (
                                  <span
                                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                                      isSelected
                                        ? 'bg-amber-400 text-gray-950 shadow-sm'
                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                    }`}
                                  >
                                    <Icon name="flame" size={11} />
                                    <span>Save ₨{savings}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-brand-text-muted font-medium">Standard</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // Custom Minute input for PER_HOUR activities (Minimum 60 minutes)
                if (currentActivity.pricingUnit === 'PER_HOUR') {
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                          Duration (Minutes)
                        </label>
                        <span className="text-[11px] font-medium text-brand-primary bg-brand-primary/10 border border-brand-primary/30 px-2.5 py-0.5 rounded-full">
                          Min 60 minutes (1 Hour)
                        </span>
                      </div>

                      <div className="space-y-3">
                        <div className="relative rounded-xl shadow-sm">
                          <input
                            type="number"
                            min={60}
                            step={15}
                            value={duration === 0 ? '' : duration}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setDuration(isNaN(val) ? 0 : Math.max(0, val));
                            }}
                            onBlur={() => {
                              if (duration < 60) {
                                setDuration(60);
                              }
                            }}
                            placeholder="Enter minutes (min 60)"
                            className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-bold text-base focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary pr-20"
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                            <span className="text-brand-text-muted text-sm font-semibold">minutes</span>
                          </div>
                        </div>

                        {/* Quick-select chips */}
                        <div className="flex flex-wrap gap-2">
                          {[
                            { mins: 60, label: '1 Hour (60m)' },
                            { mins: 90, label: '1.5 Hours (90m)' },
                            { mins: 120, label: '2 Hours (120m)' },
                            { mins: 180, label: '3 Hours (180m)' },
                          ].map((chip) => (
                            <button
                              key={chip.mins}
                              type="button"
                              onClick={() => setDuration(chip.mins)}
                              className={`px-3.5 py-2 rounded-lg border text-xs font-semibold transition-all ${
                                duration === chip.mins
                                  ? 'zo-solid-accent bg-brand-primary border-brand-primary text-white shadow-sm'
                                  : 'bg-brand-bg border-brand-border text-brand-text-muted hover:text-brand-text-main hover:border-brand-border-light'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {duration < 60 && duration > 0 && (
                          <p className="text-xs text-amber-400 flex items-center gap-1.5">
                            <Icon name="alert" size={13} />
                            <span>Minimum booking duration for this activity is 1 hour (60 minutes).</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Custom Minute input for linear PER_MINUTE activities (Minimum 30 minutes)
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider">
                        Duration (Minutes)
                      </label>
                      <span className="text-[11px] font-medium text-brand-accent bg-brand-accent/10 border border-brand-accent/30 px-2.5 py-0.5 rounded-full">
                        Min 30 minutes
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="relative rounded-xl shadow-sm">
                        <input
                          type="number"
                          min={30}
                          step={5}
                          value={duration === 0 ? '' : duration}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setDuration(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          onBlur={() => {
                            if (duration < 30) {
                              setDuration(30);
                            }
                          }}
                          placeholder="Enter minutes (min 30)"
                          className="w-full px-4 py-3 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-bold text-base focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary pr-20"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                          <span className="text-brand-text-muted text-sm font-semibold">minutes</span>
                        </div>
                      </div>

                      {/* Quick-select chips */}
                      <div className="flex flex-wrap gap-2">
                        {[30, 45, 60, 90, 120].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setDuration(mins)}
                            className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              duration === mins
                                ? 'zo-solid-accent bg-brand-primary border-brand-primary text-white shadow-sm'
                                : 'bg-brand-bg border-brand-border text-brand-text-muted hover:text-brand-text-main hover:border-brand-border-light'
                            }`}
                          >
                            {mins}m ({mins >= 60 ? `${mins / 60}h` : `${mins} min`})
                          </button>
                        ))}
                      </div>

                      {duration < 30 && duration > 0 && (
                        <p className="text-xs text-amber-400 flex items-center gap-1.5">
                          <Icon name="alert" size={13} />
                          <span>Minimum booking duration is 30 minutes.</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Estimated Subtotal */}
            <div className="pt-4 border-t border-brand-border flex items-center justify-between">
              <span className="text-sm text-brand-text-muted">Estimated Total:</span>
              <span className="text-xl font-extrabold text-brand-primary">₨{totalPrice}</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-brand-border"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={
                !selectedDate ||
                ((currentActivity?.halfHourPrice != null && currentActivity?.fullHourPrice != null) || currentActivity?.pricingUnit === 'PER_MINUTE'
                  ? duration < 30
                  : duration < 60)
              }
              onClick={() => setStep(3)}
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/25 active:scale-95 transition-all"
            >
              Find Available Slots →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Time Slot Availability in 12-Hour AM/PM */}
      {step === 3 && currentActivity && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-extrabold text-brand-text-main">Choose a Time Slot</h1>
            <p className="text-brand-text-muted text-sm">
              {currentActivity.name} • {formatDateReadable(selectedDate)} •{' '}
              {duration} mins ({duration >= 60 ? `${(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)}h` : '0.5h'})
            </p>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between text-xs text-brand-text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Available Slot
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-border-light" />
                Booked
              </span>
            </div>

            {loadingAvailability ? (
              <div className="py-12 text-center text-brand-text-muted animate-pulse">
                Checking live arena availability...
              </div>
            ) : availableSlotsList.length === 0 ? (
              <div className="py-10 text-center text-brand-text-muted">
                No active stations found for this activity.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto pr-1">
                {availableSlotsList.map(({ timeStr, display12h, available, freeResourceId }) => {
                  const isSelected = selectedTimeSlot === timeStr;

                  return (
                    <button
                      key={timeStr}
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setSelectedTimeSlot(timeStr);
                        setSelectedResourceId(freeResourceId || '');
                      }}
                      className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex flex-col items-center justify-center ${
                        isSelected
                          ? 'zo-solid-accent bg-brand-primary border-brand-primary text-white shadow-lg shadow-brand-primary/30 scale-105'
                          : available
                          ? 'bg-brand-bg border-brand-border text-emerald-400 hover:border-emerald-500/50 hover:bg-brand-card'
                          : 'bg-brand-bg/40 border-transparent text-brand-text-muted/40 cursor-not-allowed line-through'
                      }`}
                    >
                      <span>{display12h}</span>
                      <span className="text-[10px] font-normal opacity-80 mt-0.5">
                        {available ? 'Available' : 'Booked'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-brand-border"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!selectedTimeSlot || !selectedResourceId}
              onClick={() => {
                if (isGroupMode) {
                  addToGroupCart();
                } else {
                  setStep(4);
                }
              }}
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/25 active:scale-95 transition-all"
            >
              {isGroupMode ? 'Add to Group Cart +' : 'Enter Customer Details →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Customer Details */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-extrabold text-brand-text-main">Your Contact Details</h1>
            <p className="text-brand-text-muted text-sm">We&apos;ll use this to verify and confirm your slot</p>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                Full Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Ali Khan"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onBlur={() => setCustomerTouched((t) => ({ ...t, name: true }))}
                required
                className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm transition-colors ${
                  customerTouched.name && !customerName.trim()
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                    : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
                }`}
              />
              {customerTouched.name && !customerName.trim() && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Icon name="alert" size={13} />
                  <span>Full name is required</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                Mobile Number (WhatsApp) *
              </label>
              <input
                type="tel"
                placeholder="0300 1234567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onBlur={() => setCustomerTouched((t) => ({ ...t, phone: true }))}
                required
                className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm transition-colors ${
                  customerTouched.phone && !isCustomerPhoneValid
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                    : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
                }`}
              />
              {customerTouched.phone && !isCustomerPhoneValid && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Icon name="alert" size={13} />
                  <span>Please enter a valid Pakistani mobile number (e.g. 0300 1234567 or +923001234567)</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text-muted uppercase tracking-wider mb-2">
                Email Address <span className="text-brand-text-muted/60">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                onBlur={() => setCustomerTouched((t) => ({ ...t, email: true }))}
                className={`w-full px-4 py-3 bg-brand-bg border rounded-xl text-brand-text-main font-medium focus:outline-none text-sm transition-colors ${
                  customerTouched.email && !isCustomerEmailValid
                    ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/20'
                    : 'border-brand-border focus:border-brand-primary focus:ring-1 focus:ring-brand-primary'
                }`}
              />
              {customerTouched.email && !isCustomerEmailValid && (
                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                  <Icon name="alert" size={13} />
                  <span>Please enter a valid email address (e.g. name@example.com)</span>
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setStep(isGroupMode ? 1 : 3)}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-brand-border"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={!isCustomerFormValid}
              onClick={() => {
                setCustomerTouched({ name: true, phone: true, email: true });
                if (isCustomerFormValid) {
                  setStep(5);
                }
              }}
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-40 shadow-lg shadow-brand-primary/25 active:scale-95 transition-all"
            >
              Review Booking →
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Review & Confirm in 12-Hour AM/PM */}
      {step === 5 && (isGroupMode ? groupCart.length > 0 : currentActivity) && (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-extrabold text-brand-text-main">Review & Confirm</h1>
            <p className="text-brand-text-muted text-sm">Please verify your booking summary before confirming</p>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8 space-y-6">
            {isGroupMode ? (
              <>
                {/* Group Cart Items Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-4 border-b border-brand-border">
                    <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary">
                      <Icon name="layers" size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-brand-text-main">Group Booking — {groupCart.length} {groupCart.length === 1 ? 'Activity' : 'Activities'}</h3>
                      <span className="text-xs text-brand-primary font-semibold">ZeroOne Gaming Lounge</span>
                    </div>
                  </div>

                  {groupCart.map((item, idx) => {
                    const itemStart = getPKTDateTime(item.date, item.timeSlot);
                    const itemEnd = new Date(itemStart);
                    itemEnd.setMinutes(itemEnd.getMinutes() + item.duration);
                    return (
                      <div key={item.id} className="p-4 rounded-xl bg-brand-bg border border-brand-border/60 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-xl bg-brand-surface border border-brand-border text-brand-primary shrink-0">
                            <Icon name={ACTIVITY_ICON_NAMES[item.resourceType] || 'target'} size={18} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm font-bold text-brand-text-main block truncate">{idx + 1}. {item.activityName}</span>
                            <span className="text-xs text-brand-text-muted block">{formatDateReadable(item.date)} • {formatDateTimeRange(itemStart, itemEnd)}</span>
                            <span className="text-xs text-brand-text-muted block">{item.duration} mins • {item.resourceName}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {item.discountAmount > 0 && (
                            <span className="text-xs text-brand-text-muted line-through block">₨{item.originalPrice.toLocaleString()}</span>
                          )}
                          <span className="text-sm font-bold text-emerald-400">₨{item.payablePrice.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Customer Info */}
                <div className="p-4 rounded-xl bg-brand-bg border border-brand-border/60">
                  <span className="text-xs text-brand-text-muted block mb-1 uppercase tracking-wider">Customer</span>
                  <span className="font-semibold text-brand-text-main">{customerName}</span>
                  <span className="text-xs text-brand-text-muted block">{customerPhone}</span>
                </div>

                {/* Group Price Summary */}
                <div className="pt-4 border-t border-brand-border space-y-2">
                  <div className="flex items-center justify-between text-sm text-brand-text-muted">
                    <span>{groupCart.length} {groupCart.length === 1 ? 'Activity' : 'Activities'} Total:</span>
                    <span className="text-brand-text-main font-semibold">₨{groupCart.reduce((s, i) => s + i.originalPrice, 0).toLocaleString()}</span>
                  </div>
                  {groupCart.reduce((s, i) => s + i.discountAmount, 0) > 0 && (
                    <div className="flex items-center justify-between text-sm text-emerald-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Icon name="tag" size={13} />
                        <span>Total Discounts:</span>
                      </span>
                      <span>-₨{groupCart.reduce((s, i) => s + i.discountAmount, 0).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                    <div>
                      <span className="text-xs text-brand-text-muted uppercase tracking-wider block">Total Payable</span>
                      <span className="text-xs text-amber-400/90 font-medium">Advance payment required to confirm</span>
                    </div>
                    <span className="text-3xl font-black text-brand-primary">₨{groupTotalPrice.toLocaleString()}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
            <div className="flex items-center gap-4 pb-6 border-b border-brand-border">
              <div className="p-3 rounded-2xl bg-brand-bg border border-brand-border text-brand-primary">
                <Icon name={ACTIVITY_ICON_NAMES[currentActivity!.resourceType] || 'target'} size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-brand-text-main">{currentActivity!.name}</h3>
                <span className="text-xs text-brand-primary font-semibold">ZeroOne Gaming Lounge</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-brand-bg border border-brand-border/60">
                <span className="text-xs text-brand-text-muted block mb-1 uppercase tracking-wider">Date</span>
                <span className="font-semibold text-brand-text-main">{formatDateReadable(selectedDate)}</span>
              </div>

              <div className="p-4 rounded-xl bg-brand-bg border border-brand-border/60">
                <span className="text-xs text-brand-text-muted block mb-1 uppercase tracking-wider">Time Window</span>
                <span className="font-semibold text-emerald-400">{formattedSlotTime}</span>
              </div>

              <div className="p-4 rounded-xl bg-brand-bg border border-brand-border/60">
                <span className="text-xs text-brand-text-muted block mb-1 uppercase tracking-wider">Duration</span>
                <span className="font-semibold text-brand-text-main">
                  {duration} Minutes ({duration >= 60 ? `${(duration / 60).toFixed(duration % 60 === 0 ? 0 : 1)} Hour${duration / 60 > 1 ? 's' : ''}` : '30 Mins'})
                </span>
              </div>

              <div className="p-4 rounded-xl bg-brand-bg border border-brand-border/60">
                <span className="text-xs text-brand-text-muted block mb-1 uppercase tracking-wider">Customer</span>
                <span className="font-semibold text-brand-text-main">{customerName}</span>
                <span className="text-xs text-brand-text-muted block">{customerPhone}</span>
              </div>
            </div>

            {/* Optional Snacks & Café Add-ons Section */}
            {addonsList.length > 0 && (
              <div className="pt-4 border-t border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Icon name="coffee" size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-text-main">Add Snacks & Drinks (Optional)</h4>
                      <p className="text-[11px] text-brand-text-muted">Enjoy café refreshments during your gaming session</p>
                    </div>
                  </div>
                  {addonsTotalCost > 0 && (
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                      +₨{addonsTotalCost.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {addonsList.map((addon) => {
                    const qty = selectedAddons[addon.id] || 0;
                    const isOutOfStock = addon.stock !== null && addon.stock !== undefined && addon.stock <= 0;
                    const reachedMax = addon.stock !== null && addon.stock !== undefined && qty >= addon.stock;

                    return (
                      <div
                        key={addon.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          qty > 0
                            ? 'bg-brand-primary/5 border-brand-primary/40 shadow-sm'
                            : 'bg-brand-bg border-brand-border/60 hover:border-brand-border'
                        } ${isOutOfStock ? 'opacity-50 pointer-events-none' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-brand-text-main truncate">{addon.name}</span>
                            {addon.category && (
                              <span className="text-[9px] font-semibold text-brand-text-muted bg-brand-surface px-1.5 py-0.5 rounded border border-brand-border">
                                {addon.category}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-extrabold text-brand-accent">₨{addon.price.toLocaleString()}</span>
                            {addon.stock !== null && addon.stock !== undefined && (
                              <span className="text-[10px] text-brand-text-muted">
                                ({addon.stock} left)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2 shrink-0 bg-brand-surface border border-brand-border rounded-lg p-1">
                          <button
                            type="button"
                            disabled={qty === 0}
                            onClick={() => handleAddonQtyChange(addon.id, -1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-brand-text-muted hover:text-white hover:bg-brand-bg disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            -
                          </button>
                          <span className="text-xs font-mono font-bold w-4 text-center text-brand-text-main">
                            {qty}
                          </span>
                          <button
                            type="button"
                            disabled={reachedMax || isOutOfStock}
                            onClick={() => handleAddonQtyChange(addon.id, 1)}
                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-brand-text-main hover:text-white hover:bg-brand-primary disabled:opacity-30 disabled:hover:bg-transparent"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Promo Code & Voucher Box */}
            <div className="pt-4 border-t border-brand-border space-y-3">
              <label className="text-xs font-bold text-brand-text-muted uppercase tracking-wider block">
                Have a Promo Code / Voucher?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code (e.g. ZEROONE20)"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value.toUpperCase());
                    setPromoStatus({ loading: false });
                  }}
                  className="flex-1 px-4 py-2.5 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-mono text-sm focus:outline-none focus:border-brand-primary uppercase"
                />
                <button
                  type="button"
                  disabled={!promoCodeInput.trim() || promoStatus.loading}
                  onClick={handleApplyPromoCode}
                  className="px-5 py-2.5 zo-solid-accent bg-brand-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition-all"
                >
                  {promoStatus.loading ? '...' : 'Apply'}
                </button>
              </div>

              {promoStatus.error && (
                <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5">
                  <Icon name="alert" size={13} />
                  <span>{promoStatus.error}</span>
                </p>
              )}
              {promoStatus.success && (
                <p className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Icon name="check" size={13} />
                  <span>{promoStatus.success}</span>
                </p>
              )}
            </div>

            {/* Price Summary Breakdown */}
            <div className="pt-4 border-t border-brand-border space-y-2">
              <div className="flex items-center justify-between text-sm text-brand-text-muted">
                <span>Activity Subtotal:</span>
                <span className={discountAmount > 0 ? 'line-through text-brand-text-muted/60' : 'text-brand-text-main font-semibold'}>
                  ₨{originalPrice.toLocaleString()}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-emerald-400 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Icon name="tag" size={13} />
                    <span>Discount Applied ({appliedOffer?.title}):</span>
                  </span>
                  <span>-₨{discountAmount.toLocaleString()}</span>
                </div>
              )}

              {addonsTotalCost > 0 && (
                <div className="flex items-center justify-between text-sm text-brand-accent font-bold">
                  <span className="flex items-center gap-1.5">
                    <Icon name="coffee" size={13} />
                    <span>Café Add-ons Subtotal:</span>
                  </span>
                  <span>+₨{addonsTotalCost.toLocaleString()}</span>
                </div>
              )}

              <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-brand-text-muted uppercase tracking-wider block">Total Payable</span>
                  <span className="text-xs text-amber-400/90 font-medium">Advance payment required to confirm</span>
                </div>
                <span className="text-3xl font-black text-brand-primary">₨{totalPrice.toLocaleString()}</span>
              </div>
            </div>
              </>
            )}
          </div>

          <div className="pt-4 flex items-center justify-between gap-4">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(4)}
              className="px-6 py-3 rounded-xl font-semibold text-sm text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-brand-border"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={isGroupMode ? handleConfirmGroupBooking : handleConfirmBooking}
              className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-xl shadow-brand-primary/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  {isGroupMode ? 'Securing Group Slots...' : 'Securing Slot...'}
                </>
              ) : (
                'Proceed to Payment (Hold Slot) →'
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Payment Details & Screenshot Upload */}
      {step === 6 && (confirmedBooking || confirmedGroupBooking) && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-300">
          {/* Top Timer Bar */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg font-black">
                <Icon name="clock" size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-brand-text-main">Slot Held Temporarily</h2>
                <p className="text-xs text-amber-300/80">
                  Transfer payment and upload screenshot before time runs out!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-brand-bg px-4 py-2 rounded-xl border border-amber-500/40">
              <span className="text-xs text-brand-text-muted font-semibold uppercase">Expires in:</span>
              <span
                className={`font-mono text-lg font-black ${
                  timeLeft <= 180 ? 'text-brand-danger animate-pulse' : 'text-amber-400'
                }`}
              >
                {Math.floor(timeLeft / 60)
                  .toString()
                  .padStart(2, '0')}
                :{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </div>

          {/* Expired Slot Warning */}
          {isExpired && (
            <div className="bg-brand-danger/10 border border-brand-danger/30 rounded-2xl p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-danger/20 text-brand-danger mx-auto flex items-center justify-center">
                <Icon name="alert" size={24} />
              </div>
              <h3 className="text-lg font-black text-brand-danger">Slot Hold Expired!</h3>
              <p className="text-xs sm:text-sm text-brand-text-muted max-w-md mx-auto">
                The 15-minute reservation window has ended and this slot has been released back for other customers.
              </p>
              <button
                type="button"
                onClick={() => {
                  clearBookingDraft();
                  setSelectedTimeSlot('');
                  setSelectedResourceId('');
                  setConfirmedBooking(null);
                  setIsExpired(false);
                  setTimeLeft(15 * 60);
                  setStep(3);
                  fetchSlotAvailability();
                }}
                className="mt-2 px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-brand-danger hover:opacity-90 shadow-lg shadow-brand-danger/30"
              >
                ← Pick Another Slot
              </button>
            </div>
          )}

          {!isExpired && (
            <>
              {/* Payment Summary Box */}
              <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-brand-border pb-4">
                  <div>
                    <span className="text-xs text-brand-text-muted uppercase tracking-wider block">
                      Advance Payable
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-brand-primary">
                      ₨{(isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.totalAmount : confirmedBooking?.totalPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-brand-text-muted block">{isGroupMode ? 'Group Reference:' : 'Booking Reference:'}</span>
                    <span className="font-mono text-xs font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">
                      #{isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.group.id.slice(-8).toUpperCase() : confirmedBooking?.id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Account Options */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-brand-text-muted uppercase tracking-wider">
                    Select Payment Account:
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    {/* EasyPaisa */}
                    <div
                      onClick={() => setSelectedPaymentMethod('ONLINE_EASYPAISA')}
                      className={`p-4 rounded-xl cursor-pointer transition-all border flex flex-col justify-between space-y-3 ${
                        selectedPaymentMethod === 'ONLINE_EASYPAISA'
                          ? 'bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/50'
                          : 'bg-brand-bg border-brand-border hover:border-brand-border-light'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-emerald-400 uppercase">Easypaisa</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            {selectedPaymentMethod === 'ONLINE_EASYPAISA' ? 'Selected' : 'Instant'}
                          </span>
                        </div>
                        <span className="text-base font-black text-brand-text-main block font-mono">
                          {paymentSettings?.easypaisa?.number || '0312-3456789'}
                        </span>
                        <span className="text-xs text-brand-text-muted block truncate mt-0.5">
                          Title: {paymentSettings?.easypaisa?.title || 'Zero One Gaming Zone'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(paymentSettings?.easypaisa?.number || '03123456789', 'ep');
                        }}
                        className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-brand-card hover:bg-emerald-600 hover:text-white text-brand-text-main border border-brand-border transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        {copiedKey === 'ep' ? (
                          <>
                            <Icon name="check" size={13} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Icon name="copy" size={13} />
                            <span>Copy Number</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* JazzCash */}
                    <div
                      onClick={() => setSelectedPaymentMethod('ONLINE_JAZZCASH')}
                      className={`p-4 rounded-xl cursor-pointer transition-all border flex flex-col justify-between space-y-3 ${
                        selectedPaymentMethod === 'ONLINE_JAZZCASH'
                          ? 'bg-red-950/30 border-red-500 ring-2 ring-red-500/50'
                          : 'bg-brand-bg border-brand-border hover:border-brand-border-light'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-red-400 uppercase">JazzCash</span>
                          <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded font-bold">
                            {selectedPaymentMethod === 'ONLINE_JAZZCASH' ? 'Selected' : 'Instant'}
                          </span>
                        </div>
                        <span className="text-base font-black text-brand-text-main block font-mono">
                          {paymentSettings?.jazzcash?.number || '0300-1234567'}
                        </span>
                        <span className="text-xs text-brand-text-muted block truncate mt-0.5">
                          Title: {paymentSettings?.jazzcash?.title || 'Zero One Gaming Zone'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(paymentSettings?.jazzcash?.number || '03001234567', 'jc');
                        }}
                        className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-brand-card hover:bg-red-600 hover:text-white text-brand-text-main border border-brand-border transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        {copiedKey === 'jc' ? (
                          <>
                            <Icon name="check" size={13} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Icon name="copy" size={13} />
                            <span>Copy Number</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Bank Transfer */}
                    <div
                      onClick={() => setSelectedPaymentMethod('ONLINE_BANK')}
                      className={`p-4 rounded-xl cursor-pointer transition-all border flex flex-col justify-between space-y-3 ${
                        selectedPaymentMethod === 'ONLINE_BANK'
                          ? 'bg-brand-primary/10 border-brand-primary ring-2 ring-brand-primary/50'
                          : 'bg-brand-bg border-brand-border hover:border-brand-border-light'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-black text-brand-primary uppercase">Bank Transfer</span>
                          <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-1.5 py-0.5 rounded font-bold">
                            {selectedPaymentMethod === 'ONLINE_BANK' ? 'Selected' : 'IBFT'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-brand-text-main block">
                          {paymentSettings?.bank?.bankName || 'Meezan Bank Ltd'}
                        </span>
                        <span className="text-xs font-mono font-bold text-brand-primary block truncate mt-0.5">
                          A/C: {paymentSettings?.bank?.accountNumber || '01010101010101'}
                        </span>
                        <span className="text-[10px] text-brand-text-muted block truncate mt-0.5">
                          {paymentSettings?.bank?.title || 'Zero One Gaming'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(paymentSettings?.bank?.accountNumber || '01010101010101', 'bank');
                        }}
                        className="w-full py-2.5 px-3 rounded-lg text-xs font-bold bg-brand-card hover:bg-brand-primary hover:text-white text-brand-text-main border border-brand-border transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        {copiedKey === 'bank' ? (
                          <>
                            <Icon name="check" size={13} />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Icon name="copy" size={13} />
                            <span>Copy A/C</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Amount Paid Input */}
                <div className="pt-4 border-t border-brand-border space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-brand-text-muted uppercase tracking-wider block">
                      Amount Paid (PKR):
                    </label>
                    <span className="text-[11px] text-brand-text-muted">
                      Default: ₨{(isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.totalAmount : confirmedBooking?.totalPrice || 0).toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="number"
                    value={amountPaidInput}
                    onChange={(e) => setAmountPaidInput(e.target.value)}
                    placeholder={`₨ ${isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.totalAmount : confirmedBooking?.totalPrice || 0}`}
                    className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-xl text-brand-text-main font-bold text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>

                {/* Screenshot Upload Form */}
                <div className="pt-6 border-t border-brand-border space-y-4">
                  <span className="text-xs font-black text-brand-text-muted uppercase tracking-wider block">
                    Upload Payment Proof / Receipt:
                  </span>

                  <div className="relative border-2 border-dashed border-brand-border hover:border-brand-primary/60 bg-brand-bg rounded-2xl p-6 text-center transition-all">
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {filePreview ? (
                      <div className="space-y-3">
                        <img
                          src={filePreview}
                          alt="Receipt Preview"
                          className="max-h-48 mx-auto rounded-xl object-contain border border-brand-border shadow-md"
                        />
                        <span className="text-xs font-semibold text-emerald-400 block flex items-center justify-center gap-1">
                          <Icon name="check" size={13} />
                          <span>Screenshot selected ({selectedFile?.name}) — Click to change</span>
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-2xl bg-brand-surface border border-brand-border flex items-center justify-center text-brand-text-muted">
                          <Icon name="camera" size={24} />
                        </div>
                        <span className="text-sm font-bold text-brand-text-main block">
                          Click or drag & drop payment screenshot here
                        </span>
                        <span className="text-xs text-brand-text-muted block">
                          Accepts JPG, PNG, WEBP up to 5MB
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Payment Proof Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm text-brand-text-muted hover:text-brand-text-main bg-brand-surface border border-brand-border min-h-[44px] flex items-center justify-center"
                >
                  ← Back to Details
                </button>
                <button
                  type="button"
                  disabled={!filePreview || uploadingPayment}
                  onClick={isGroupMode ? handleUploadGroupPayment : handleUploadPayment}
                  className="w-full sm:w-auto px-10 py-4 rounded-xl font-black text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-95 disabled:opacity-40 shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 min-h-[48px]"
                >
                  {uploadingPayment ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Uploading Screenshot...
                    </>
                  ) : (
                    <>
                      <span>Submit Payment & Request Approval</span>
                      <Icon name="check" size={14} />
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 7: Booking Under Review (No confirmation slip shown yet) */}
      {step === 7 && (confirmedBooking || confirmedGroupBooking) && (
        <div className="space-y-8 animate-in fade-in zoom-in duration-300 max-w-lg mx-auto text-center py-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-brand-primary/10 border-2 border-brand-primary/40 text-brand-primary flex items-center justify-center mx-auto shadow-xl shadow-brand-primary/20 ring-4 ring-brand-primary/10">
            <Icon name="search" size={32} />
          </div>

          <div className="space-y-2">
            <h1 className="zo-inner-title text-2xl sm:text-3xl font-black text-brand-text-main tracking-tight">
              Payment Under Verification!
            </h1>
            <p className="text-brand-text-muted text-xs sm:text-sm max-w-md mx-auto">
              Your payment receipt has been submitted for {isGroupMode ? 'group' : 'booking'} reference:
            </p>
            <span className="inline-block font-mono font-bold text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-lg border border-brand-primary/30 text-sm">
              #{isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.group.id.slice(-8).toUpperCase() : confirmedBooking?.id.slice(-8).toUpperCase()}
            </span>
          </div>

          <div className="bg-brand-surface border border-brand-border rounded-2xl p-6 text-left space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Icon name="check" size={14} /> <span>Payment Screenshot Received</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
              <Icon name="clock" size={14} /> <span>Admin Review in Progress (Usually takes 5-10 mins)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border text-xs text-brand-text-muted space-y-1">
              <span className="font-bold text-brand-text-main block">WhatsApp Notification:</span>
              <p className="text-brand-text-muted">
                Once our team verifies your transaction, your booking will be confirmed and your official Digital Slip will be dispatched to your WhatsApp number ({customerPhone}).
              </p>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/my-bookings"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white zo-solid-accent bg-brand-primary hover:opacity-90 shadow-lg shadow-brand-primary/30 transition-all"
            >
              View in My Bookings →
            </Link>
            <Link
              href="/"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-brand-text-muted bg-brand-card hover:bg-brand-card-hover border border-brand-border transition-all"
            >
              Return to Home
            </Link>
          </div>
        </div>
      )}

      {/* FALLBACK: Direct Digital Receipt for Confirmed Bookings */}
      {step === 8 && (confirmedBooking || confirmedGroupBooking) && (
        <div className="space-y-8 animate-in fade-in zoom-in duration-300">
          {/* Top Status Header */}
          <div className="text-center space-y-3 no-print">
            <div className="relative inline-flex items-center justify-center">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-500/10">
                <svg
                  className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-400 stroke-[2.5]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-6 w-6 bg-emerald-500 items-center justify-center text-white text-[11px] font-black">
                  <Icon name="check" size={12} />
                </span>
              </span>
            </div>

            <div className="space-y-1.5">
              <h1 className="zo-inner-title text-3xl sm:text-4xl font-black text-brand-text-main tracking-tight">
                Booking Request Sent!
              </h1>
              <p className="text-brand-text-muted text-xs sm:text-sm max-w-md mx-auto">
                Reference ID:{' '}
                <span className="font-mono font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded border border-brand-primary/30">
                  #{isGroupMode && confirmedGroupBooking ? `GRP-${confirmedGroupBooking.group.id.slice(-6).toUpperCase()}` : `BKG-${confirmedBooking?.id.slice(-6).toUpperCase()}`}
                </span>
              </p>
            </div>
          </div>

          {/* Premium Digital Receipt / Ticket Card */}
          <div className="max-w-lg mx-auto printable-slip-wrapper">
            <div className="relative bg-brand-surface border border-brand-border rounded-3xl zo-panel overflow-hidden shadow-2xl printable-slip-card ring-1 ring-brand-primary/20">
              {/* Glowing Top Edge */}
              <div className="h-1.5 w-full zo-solid-accent bg-brand-primary" />

              {/* Receipt Header */}
              <div className="p-6 sm:p-7 border-b border-dashed border-brand-border text-center relative bg-brand-bg/60">
                <div className="w-12 h-12 rounded-2xl zo-solid-accent bg-brand-primary flex items-center justify-center font-black text-xl mx-auto shadow-lg shadow-brand-primary/25 text-white mb-2.5">
                  01
                </div>
                <h2 className="text-xl font-black tracking-wider text-brand-text-main">ZERO ONE GAMING ZONE</h2>
                <p className="text-xs text-brand-text-muted mt-0.5">Islamabad F-7 • Official Digital Receipt</p>

                {/* Status Badge */}
                <div className="mt-3.5 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="flex items-center gap-1.5">
                    <span>Status:</span>
                    <Icon name="clock" size={12} />
                    <span>PENDING (Admin Approval)</span>
                  </span>
                </div>
              </div>

              {/* Ticket Notches (Cut-outs on left & right) */}
              <div className="relative flex items-center justify-between no-print">
                <div className="w-5 h-8 bg-brand-bg border-r border-t border-b border-brand-border rounded-r-full -ml-px" />
                <div className="w-full border-b border-dashed border-brand-border/80 my-0 mx-2" />
                <div className="w-5 h-8 bg-brand-bg border-l border-t border-b border-brand-border rounded-l-full -mr-px" />
              </div>

              {/* Booking Details Summary */}
              <div className="p-6 sm:p-7 space-y-4 text-sm bg-transparent text-brand-text-main">
                {isGroupMode && confirmedGroupBooking ? (
                  <>
                    {/* Group Items List */}
                    <div className="space-y-2.5">
                      {confirmedGroupBooking.bookings.map((bk, idx) => {
                        const cartItem = groupCart[idx];
                        return (
                          <div key={bk.id} className="p-3.5 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="p-2 rounded-lg bg-brand-surface border border-brand-border text-brand-primary shrink-0">
                                <Icon name={ACTIVITY_ICON_NAMES[cartItem?.resourceType || bk.resource.type] || 'target'} size={16} />
                              </div>
                              <div className="min-w-0">
                                <span className="text-sm font-bold text-brand-text-main block truncate">{cartItem?.activityName || bk.resource.name}</span>
                                <span className="text-xs text-brand-text-muted block">{bk.resource.name} • {formatDateTimeRange(new Date(bk.startTime), new Date(bk.endTime))}</span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-emerald-400 shrink-0">₨{bk.totalPrice.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Customer Info */}
                    <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border">
                      <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider block">
                        Reserved For
                      </span>
                      <span className="font-bold text-brand-text-main text-sm mt-1 block truncate">
                        {confirmedGroupBooking.customer.name}
                      </span>
                      <span className="text-xs text-brand-text-muted block">{confirmedGroupBooking.customer.phone}</span>
                    </div>
                  </>
                ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Activity Name */}
                  <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider">
                      Game / Activity
                    </span>
                    <span className="font-bold text-brand-text-main text-base mt-1 flex items-center gap-1.5">
                      <Icon
                        name={ACTIVITY_ICON_NAMES[currentActivity?.resourceType || ''] || 'gamepad'}
                        size={16}
                      />
                      <span className="truncate">{currentActivity?.name}</span>
                    </span>
                  </div>

                  {/* Resource / Station */}
                  <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border flex flex-col justify-between">
                    <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider">
                      Station / Arena
                    </span>
                    <span className="font-bold text-brand-primary text-base mt-1 truncate">
                      {confirmedBooking!.resource.name}
                    </span>
                  </div>

                  {/* Date & Time */}
                  <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border col-span-1 sm:col-span-2">
                    <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider block">
                      Date & Time Window
                    </span>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                      <span className="font-semibold text-brand-text-main">
                        {formatDateReadable(selectedDate)}
                      </span>
                      <span className="font-bold text-emerald-400">
                        {formattedSlotTime}
                      </span>
                    </div>
                  </div>

                  {/* Total Duration */}
                  <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border">
                    <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider block">
                      Total Duration
                    </span>
                    <span className="font-bold text-brand-text-main text-base mt-1 block">
                      {duration} minutes
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border">
                    <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider block">
                      Reserved For
                    </span>
                    <span className="font-bold text-brand-text-main text-sm mt-1 block truncate">
                      {confirmedBooking!.customer.name}
                    </span>
                    <span className="text-xs text-brand-text-muted block">{confirmedBooking!.customer.phone}</span>
                  </div>

                  {/* Add-ons line items on digital ticket */}
                  {confirmedBooking?.addons && confirmedBooking.addons.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-brand-bg border border-brand-border col-span-1 sm:col-span-2 space-y-1.5">
                      <span className="text-[11px] font-semibold text-brand-text-muted uppercase tracking-wider block flex items-center gap-1">
                        <Icon name="coffee" size={13} />
                        <span>Café Add-ons Included</span>
                      </span>
                      <div className="space-y-1 pt-1">
                        {confirmedBooking.addons.map((addon) => (
                          <div key={addon.id} className="flex items-center justify-between text-xs">
                            <span className="text-brand-text-main">
                              {addon.addonItem?.name || 'Add-on'} <span className="text-brand-text-muted font-bold">× {addon.quantity}</span>
                            </span>
                            <span className="font-bold text-brand-accent">
                              ₨{(addon.priceAtBooking * addon.quantity).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Total Payable Amount */}
                <div className="pt-4 border-t border-brand-border flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-brand-text-muted uppercase tracking-wider block">
                      Total Amount
                    </span>
                    <span className="text-[11px] text-brand-text-muted">Pay at counter upon arrival</span>
                  </div>
                  <span className="text-3xl font-black text-brand-primary">
                    ₨{(isGroupMode && confirmedGroupBooking ? confirmedGroupBooking.totalAmount : confirmedBooking?.totalPrice || 0).toLocaleString()}
                  </span>
                </div>

                {/* Next Steps Notice */}
                <div className="p-4 rounded-2xl bg-brand-bg border border-brand-primary/20 text-xs text-brand-text-muted leading-relaxed text-center space-y-1">
                  <p className="font-semibold text-brand-text-main flex items-center justify-center gap-1.5">
                    <Icon name="message" size={14} /> <span>WhatsApp Confirmation Alert</span>
                  </p>
                  <p className="text-brand-text-muted">
                    Thank you! Your booking request has been sent to our team. We will review it shortly and you will receive a confirmation alert on WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action & Navigation Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-lg mx-auto no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <Icon name="printer" size={14} /> <span>Print / Save Receipt</span>
            </button>
            <Link
              href="/"
              className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-brand-text-muted bg-brand-card hover:bg-brand-card-hover border border-brand-border text-center transition-all"
            >
              Return to Home
            </Link>
            <button
              type="button"
              onClick={() => {
                clearBookingDraft();
                setStep(1);
                setSelectedActivityId('');
                setPrevActivityId('');
                setSelectedTimeSlot('');
                setSelectedResourceId('');
                setConfirmedBooking(null);
                setConfirmedGroupBooking(null);
                setGroupCart([]);
                setIsGroupMode(false);
                setCustomerName('');
                setCustomerPhone('');
                setCustomerEmail('');
                setAppliedOffer(null);
                setPromoCodeInput('');
              }}
              className="w-full sm:w-auto flex-1 px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 transition-all text-center"
            >
              Book Another Activity +
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Floating Group Cart Drawer for Steps 2 & 3 */}
      {isGroupMode && groupCart.length > 0 && (step === 2 || step === 3) && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-2xl mx-auto animate-in slide-in-from-bottom duration-300">
          <div className="bg-brand-surface/95 backdrop-blur-md border-2 border-brand-primary/40 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-primary/20 text-brand-primary">
                <Icon name="layers" size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-brand-text-main block">
                  Group Cart ({groupCart.length} {groupCart.length === 1 ? 'activity' : 'activities'})
                </span>
                <span className="text-xs font-extrabold text-emerald-400">
                  Total: ₨{groupTotalPrice.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-brand-text-muted hover:text-brand-text-main bg-brand-bg border border-brand-border transition-all"
              >
                View Cart
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white zo-solid-accent bg-brand-primary hover:opacity-95 shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all"
              >
                <span>Checkout Now →</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">Loading booking wizard...</div>}>
      <BookingContent />
    </Suspense>
  );
}

