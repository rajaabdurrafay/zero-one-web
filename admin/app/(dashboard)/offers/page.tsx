'use client';

import { businessDate, businessInstant } from '@zeroone/domain';
import { useState, useEffect, useRef } from 'react';
import { getOffers, createOffer, updateOffer, toggleOfferActive, toggleOfferVisibility, deleteOffer, getPricing, Offer, Activity } from '@/lib/api';
import { Icon } from '@/components/Icon';
import Select from '@/components/Select';
import { PageContainer } from '@/components/Card';
import toast from 'react-hot-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getBannerSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_BASE}${url}`;
}

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bannerPreviewBase64, setBannerPreviewBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState(() => ({
    title: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: 20,
    applicableTo: 'ALL_ACTIVITIES' as 'ALL_ACTIVITIES' | 'SPECIFIC_ACTIVITY',
    activityId: '',
    validFrom: businessDate(),
    validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
    isVisibleOnWebsite: true,
    minDuration: 60,
    promoCode: '',
    bannerImageUrl: '',
  }));

  async function loadData() {
    try {
      setLoading(true);
      const [offersData, activitiesData] = await Promise.all([getOffers(), getPricing()]);
      setOffers(offersData);
      setActivities(activitiesData);
    } catch (err: any) {
      console.error('Failed to load offers:', err);
      setError(err.message || 'Could not load offers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleOpenCreate() {
    setEditingOffer(null);
    setError('');
    setBannerPreviewBase64(null);
    setFormData({
      title: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      applicableTo: 'ALL_ACTIVITIES',
      activityId: '',
      validFrom: businessDate(),
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isActive: true,
      isVisibleOnWebsite: true,
      minDuration: 60,
      promoCode: '',
      bannerImageUrl: '',
    });
    setIsModalOpen(true);
  }

  function handleOpenEdit(offer: Offer) {
    setEditingOffer(offer);
    setError('');
    setBannerPreviewBase64(null);
    setFormData({
      title: offer.title,
      description: offer.description || '',
      discountType: offer.discountType,
      discountValue: offer.discountValue,
      applicableTo: offer.applicableTo,
      activityId: offer.activityId || '',
      validFrom: new Date(offer.validFrom).toISOString().split('T')[0],
      validUntil: new Date(offer.validUntil).toISOString().split('T')[0],
      isActive: offer.isActive,
      isVisibleOnWebsite: offer.isVisibleOnWebsite !== false,
      minDuration: offer.minDuration || 60,
      promoCode: offer.promoCode || '',
      bannerImageUrl: offer.bannerImageUrl || '',
    });
    setIsModalOpen(true);
  }

  async function handleToggle(id: string) {
    try {
      await toggleOfferActive(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Could not change this offer');
    }
  }

  async function handleToggleVisibility(id: string) {
    try {
      await toggleOfferVisibility(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Could not change visibility of this offer');
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Archive the offer "${title}"? Booking history will be retained.`)) return;
    try {
      await deleteOffer(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Could not archive this offer');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const payload: any = {
        title: formData.title,
        description: formData.description || null,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        applicableTo: formData.applicableTo,
        activityId:
          formData.applicableTo === 'SPECIFIC_ACTIVITY' && formData.activityId ? formData.activityId : null,
        validFrom: businessInstant(formData.validFrom).toISOString(),
        validUntil: new Date(businessInstant(formData.validUntil).getTime()+86400000-1).toISOString(),
        isActive: formData.isActive,
        isVisibleOnWebsite: formData.isVisibleOnWebsite,
        minDuration: formData.minDuration ? Number(formData.minDuration) : null,
        promoCode: formData.promoCode ? formData.promoCode.trim().toUpperCase() : null,
        bannerImageUrl: bannerPreviewBase64 || formData.bannerImageUrl || null,
      };

      if (editingOffer) {
        await updateOffer(editingOffer.id, payload);
      } else {
        await createOffer(payload);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Could not save this offer');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted max-w-xl">
          Discounts and promo codes apply automatically in the customer booking flow.
        </p>
        <button onClick={handleOpenCreate} className="btn btn-primary">
          <Icon name="plus" size={15} />
          New offer
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-60 gap-3 text-muted text-[13px]">
          <span className="spinner" />
          Loading offers…
        </div>
      ) : offers.length === 0 ? (
        <div className="panel px-6 py-16 text-center">
          <Icon name="tag" size={26} className="text-faint mx-auto" />
          <h2 className="display text-[20px] text-text mt-4">No offers yet</h2>
          <p className="text-[13px] text-muted mt-2 max-w-md mx-auto leading-relaxed">
            Build one like &ldquo;Late-night snooker, 20% off&rdquo; or a weekend PS5 rate to fill quiet hours.
          </p>
          <button onClick={handleOpenCreate} className="btn btn-primary mt-6 mx-auto">
            <Icon name="plus" size={15} />
            Create the first offer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offers.map((offer) => {
            const isExpired = new Date(offer.validUntil) < new Date();
            const isLive = offer.isActive && !isExpired;

            return (
              <article key={offer.id} className={`panel flex flex-col ${isLive ? 'border-brass/40' : ''}`}>
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`pill ${isLive ? 'pill-live' : isExpired ? 'pill-neutral' : 'pill-wait'}`}>
                        {isExpired ? 'Expired' : offer.isActive ? 'Live' : 'Paused'}
                      </span>
                      {offer.isVisibleOnWebsite ? (
                        <span className="pill pill-bare text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 text-[10.5px] inline-flex items-center gap-1">
                          <Icon name="eye" size={11} />
                          <span>Public</span>
                        </span>
                      ) : (
                        <span className="pill pill-bare text-amber-400 bg-amber-500/10 border border-amber-500/30 text-[10.5px] inline-flex items-center gap-1">
                          <Icon name="lock" size={11} />
                          <span>Hidden</span>
                        </span>
                      )}
                    </div>
                    {offer.promoCode && (
                      <span className="pill pill-bare pill-brass tnum">{offer.promoCode}</span>
                    )}
                  </div>

                  <h2 className="display text-[20px] text-text mt-3.5 leading-tight">{offer.title}</h2>

                  <p className="display text-[30px] text-brass mt-2 tnum">
                    {offer.discountType === 'PERCENTAGE'
                      ? `${offer.discountValue}% off`
                      : `₨${offer.discountValue.toLocaleString()} off`}
                  </p>
                  <p className="text-[12px] text-muted mt-1">
                    {offer.applicableTo === 'ALL_ACTIVITIES'
                      ? 'Every activity'
                      : offer.activity?.name || 'One activity'}
                  </p>

                  {offer.description && (
                    <p className="text-[12px] text-muted mt-3 leading-relaxed line-clamp-2">
                      {offer.description}
                    </p>
                  )}

                  <dl className="mt-4 pt-4 border-t border-line space-y-2 text-[12px]">
                    <div className="flex justify-between gap-3">
                      <dt className="text-faint">Runs</dt>
                      <dd className="text-text tnum">
                        {new Date(offer.validFrom).toLocaleDateString()} –{' '}
                        {new Date(offer.validUntil).toLocaleDateString()}
                      </dd>
                    </div>
                    {offer.minDuration && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-faint">Minimum</dt>
                        <dd className="text-text tnum">{offer.minDuration} min</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <dt className="text-faint">Claimed</dt>
                      <dd className="text-brass tnum font-semibold">{offer._count?.bookings || 0}×</dd>
                    </div>
                  </dl>
                </div>

                <div className="px-5 py-3.5 border-t border-line flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => handleToggle(offer.id)} className="btn btn-ghost text-xs">
                      {offer.isActive ? 'Pause' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleToggleVisibility(offer.id)}
                      className={`btn btn-ghost text-xs ${offer.isVisibleOnWebsite ? 'text-muted hover:text-text' : 'text-amber-400 hover:text-amber-300'}`}
                      title="Toggle website visibility"
                    >
                      {offer.isVisibleOnWebsite ? 'Hide on Site' : 'Show on Site'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(offer)}
                      className="p-2 rounded-[3px] text-muted hover:text-brass hover:bg-raised transition-colors"
                      aria-label={`Edit ${offer.title}`}
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(offer.id, offer.title)}
                      className="p-2 rounded-[3px] text-muted hover:text-stop hover:bg-raised transition-colors"
                      aria-label={`Archive ${offer.title}`}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingOffer ? 'Edit offer' : 'New offer'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 backdrop-blur-sm p-4"
        >
          <div className="panel w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="panel-head">
              <div>
                <h2 className="display text-[19px] text-text">
                  {editingOffer ? 'Edit offer' : 'New offer'}
                </h2>
                <p className="text-[12px] text-muted mt-1">
                  Applies to customer pricing as soon as it goes live.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted hover:text-text transition-colors shrink-0"
                aria-label="Close"
              >
                <Icon name="close" size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              {error && (
                <p className="flex items-start gap-2 text-[12px] text-stop bg-stop/10 border border-stop/35 rounded-[4px] px-3 py-2.5">
                  <Icon name="alert" size={14} className="mt-px" />
                  <span>{error}</span>
                </p>
              )}

              <div>
                <label className="field-label">Banner Image</label>
                <div className="flex items-center gap-4 mt-2">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-20 rounded-[4px] bg-raised border border-line flex flex-col items-center justify-center cursor-pointer hover:border-brass transition-colors"
                  >
                    {(bannerPreviewBase64 || formData.bannerImageUrl) ? (
                      <img
                        src={bannerPreviewBase64 || getBannerSrc(formData.bannerImageUrl)!}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-[4px]"
                      />
                    ) : (
                      <>
                        <Icon name="image" size={20} className="text-muted" />
                        <span className="text-[10px] text-muted">Upload</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn btn-secondary text-xs"
                    >
                      {formData.bannerImageUrl || bannerPreviewBase64 ? 'Change' : 'Upload Image'}
                    </button>
                    {(formData.bannerImageUrl || bannerPreviewBase64) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, bannerImageUrl: '' });
                          setBannerPreviewBase64(null);
                        }}
                        className="btn btn-ghost text-xs text-stop"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      e.target.value = '';
                      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                        toast.error('Choose a PNG, JPEG, WebP or GIF image under 5 MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setBannerPreviewBase64(ev.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </div>

              <div>
                <label htmlFor="offer-title" className="field-label">
                  Title
                </label>
                <input
                  id="offer-title"
                  type="text"
                  required
                  placeholder="Late-night snooker"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="field"
                />
              </div>

              <div>
                <label htmlFor="offer-desc" className="field-label">
                  Description
                </label>
                <textarea
                  id="offer-desc"
                  rows={2}
                  placeholder="Shown on the activity cards and the offer banner"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="field resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Select
                    id="offer-type"
                    label="Discount type"
                    value={formData.discountType}
                    onChange={(val) => setFormData({ ...formData, discountType: val })}
                    options={[
                      { value: 'PERCENTAGE', label: 'Percentage' },
                      { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
                    ]}
                  />
                </div>

                <div>
                  <label htmlFor="offer-value" className="field-label">
                    Discount value
                  </label>
                  <div className="relative">
                    <input
                      id="offer-value"
                      type="number"
                      required
                      min={1}
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                      className="field tnum pr-12"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-faint">
                      {formData.discountType === 'PERCENTAGE' ? '%' : 'PKR'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Select
                    id="offer-scope"
                    label="Applies to"
                    value={formData.applicableTo}
                    onChange={(val) => setFormData({ ...formData, applicableTo: val })}
                    options={[
                      { value: 'ALL_ACTIVITIES', label: 'Every activity' },
                      { value: 'SPECIFIC_ACTIVITY', label: 'One activity' },
                    ]}
                  />
                </div>

                {formData.applicableTo === 'SPECIFIC_ACTIVITY' && (
                  <div>
                    <Select
                      id="offer-activity"
                      label="Activity"
                      required
                      placeholder="Choose one"
                      value={formData.activityId}
                      onChange={(val) => setFormData({ ...formData, activityId: val })}
                      options={activities.map((act) => ({
                        value: act.id,
                        label: act.name,
                      }))}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="offer-code" className="field-label">
                    Promo code
                  </label>
                  <input
                    id="offer-code"
                    type="text"
                    placeholder="ZEROONE20"
                    value={formData.promoCode}
                    onChange={(e) => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                    className="field tnum uppercase"
                  />
                  <p className="text-[11px] text-faint mt-1.5">
                    Leave empty to discount everyone automatically.
                  </p>
                </div>

                <div>
                  <label htmlFor="offer-min" className="field-label">
                    Minimum duration
                  </label>
                  <div className="relative">
                    <input
                      id="offer-min"
                      type="number"
                      min={0}
                      step={30}
                      placeholder="60"
                      value={formData.minDuration}
                      onChange={(e) => setFormData({ ...formData, minDuration: Number(e.target.value) })}
                      className="field tnum pr-12"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] text-faint">
                      min
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="offer-from" className="field-label">
                    Starts
                  </label>
                  <input
                    id="offer-from"
                    type="date"
                    required
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className="field tnum"
                  />
                </div>

                <div>
                  <label htmlFor="offer-until" className="field-label">
                    Ends
                  </label>
                  <input
                    id="offer-until"
                    type="date"
                    required
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className="field tnum"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="isActive"
                  className="flex items-center gap-3 bg-raised border border-line rounded-[4px] px-3.5 py-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 accent-brass"
                  />
                  <div>
                    <span className="text-[13px] text-text font-medium block">Active Status</span>
                    <span className="text-[11px] text-muted block">When OFF, the discount and promo code are completely disabled.</span>
                  </div>
                </label>

                <label
                  htmlFor="isVisibleOnWebsite"
                  className="flex items-center gap-3 bg-raised border border-line rounded-[4px] px-3.5 py-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    id="isVisibleOnWebsite"
                    checked={formData.isVisibleOnWebsite}
                    onChange={(e) => setFormData({ ...formData, isVisibleOnWebsite: e.target.checked })}
                    className="w-4 h-4 accent-brass"
                  />
                  <div>
                    <span className="text-[13px] text-text font-medium block">Show on Website (Public Banner & Rates)</span>
                    <span className="text-[11px] text-muted block">
                      When OFF, this offer won&#39;t appear in the offers banner or pricing page — but the promo code will still work if a customer enters it manually. Perfect for influencer-exclusive codes.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting && <span className="spinner" />}
                  {submitting ? 'Saving…' : editingOffer ? 'Save offer' : 'Create offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
