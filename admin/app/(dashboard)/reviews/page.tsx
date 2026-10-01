'use client';

import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { Icon } from '@/components/Icon';
import { getReviews, createReviewManual, updateReview, deleteReview, type Review } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAvatarSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-base' : 'w-10 h-10 text-sm';
  const src = getAvatarSrc(url);
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover border border-line shrink-0`}
      />
    );
  }
  return (
    <div className={`${sizeClasses} rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StarDisplay({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Icon
          key={i}
          name="star"
          size={13}
          className={i < rating ? 'text-amber-500 fill-amber-500' : 'text-line fill-line'}
        />
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="w-10 h-10 rounded-xl bg-raised border border-line flex items-center justify-center transition-colors hover:border-amber-500/50 active:scale-95 cursor-pointer"
          >
            <Icon
              name="star"
              size={22}
              className={star <= (hover || value) ? 'text-amber-500 fill-amber-500' : 'text-muted/40'}
            />
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-xs font-bold text-text">{labels[value]}</span>
      )}
    </div>
  );
}

function AvatarUpload({
  previewBase64,
  existingUrl,
  onFileChange,
  onClear,
}: {
  previewBase64: string | null;
  existingUrl?: string | null;
  onFileChange: (base64: string | null) => void;
  onClear: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displaySrc = previewBase64 || getAvatarSrc(existingUrl);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Avatar image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => onFileChange(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-4">
      {displaySrc ? (
        <div className="relative shrink-0">
          <img
            src={displaySrc}
            alt="Avatar preview"
            className="w-16 h-16 rounded-2xl object-cover border-2 border-primary/30"
          />
          <button
            type="button"
            onClick={() => { onClear(); }}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-stop text-white flex items-center justify-center"
          >
            <Icon name="close" size={10} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-16 h-16 rounded-2xl border-2 border-dashed border-line flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/50 hover:bg-raised transition-colors shrink-0"
        >
          <Icon name="image" size={18} className="text-muted" />
          <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Photo</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-raised border border-line text-xs font-bold text-text hover:border-primary/50 transition-colors cursor-pointer"
        >
          <Icon name="image" size={13} />
          {displaySrc ? 'Change Photo' : 'Upload Photo'}
        </button>
        <p className="text-[11px] text-muted mt-1">Optional · JPG, PNG, WebP · Max 2MB</p>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'all'>('all');

  // Manual Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState('');
  const [newIsFeatured, setNewIsFeatured] = useState(false);
  const [newAvatarBase64, setNewAvatarBase64] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await getReviews(filterStatus === 'all' ? undefined : filterStatus);
      setReviews(data);
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [filterStatus]);

  const handleApproveToggle = async (review: Review) => {
    try {
      const nextStatus = !review.isApproved;
      setReviews(reviews.map(r => r.id === review.id ? { ...r, isApproved: nextStatus } : r));
      await updateReview(review.id, { isApproved: nextStatus });
      toast.success(nextStatus ? 'Review approved' : 'Review set to pending');
    } catch {
      toast.error('Failed to update review');
      fetchReviews();
    }
  };

  const handleFeatureToggle = async (review: Review) => {
    try {
      const nextFeatured = !review.isFeatured;
      setReviews(reviews.map(r => r.id === review.id ? { ...r, isFeatured: nextFeatured } : r));
      await updateReview(review.id, { isFeatured: nextFeatured });
      toast.success(nextFeatured ? 'Pinned to homepage' : 'Unpinned from homepage');
    } catch {
      toast.error('Failed to update');
      fetchReviews();
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await deleteReview(id);
      toast.success('Review deleted');
      setReviews(reviews.filter(r => r.id !== id));
    } catch {
      toast.error('Failed to delete review');
    }
  };

  const resetModal = () => {
    setNewName('');
    setNewRating(5);
    setNewText('');
    setNewIsFeatured(false);
    setNewAvatarBase64(null);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) { toast.error('Please enter the customer name'); return; }
    if (newRating === 0) { toast.error('Please select a star rating'); return; }
    if (!newText.trim()) { toast.error('Please write a review comment'); return; }

    try {
      setIsSubmitting(true);
      await createReviewManual({
        customerName: newName.trim(),
        rating: newRating,
        reviewText: newText.trim(),
        isApproved: true,
        isFeatured: newIsFeatured,
        avatarBase64: newAvatarBase64 || undefined,
      });
      toast.success('Review added successfully');
      setShowAddModal(false);
      resetModal();
      fetchReviews();
    } catch {
      toast.error('Failed to create review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = reviews.filter(r => !r.isApproved).length;
  const approvedCount = reviews.filter(r => r.isApproved).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">Customer Reviews</h1>
          <p className="text-muted text-sm mt-0.5">Moderate testimonials and inject reviews manually.</p>
        </div>
        <button
          onClick={() => { resetModal(); setShowAddModal(true); }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-xs cursor-pointer"
        >
          <Icon name="plus" size={15} />
          <span>Add Manually</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: reviews.length, color: 'text-text' },
          { label: 'Pending', value: pendingCount, color: 'text-amber-500' },
          { label: 'Approved', value: approvedCount, color: 'text-emerald-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface border border-line rounded-2xl p-4 text-center shadow-xs">
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] font-bold text-muted uppercase tracking-wider mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'pending', 'approved'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors capitalize cursor-pointer ${
              filterStatus === tab
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface text-muted hover:text-text border border-line'
            }`}
          >
            {tab === 'pending' ? 'Pending Approval' : tab}
            {tab !== 'all' && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                filterStatus === tab ? 'bg-white/20' : 'bg-raised'
              }`}>
                {tab === 'pending' ? pendingCount : approvedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews Grid */}
      {loading ? (
        <div className="p-16 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 bg-surface border border-line rounded-2xl text-muted text-sm">
          No reviews found for this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-surface border border-line rounded-2xl p-5 flex flex-col gap-4 shadow-xs hover:shadow-sm transition-shadow"
            >
              {/* Top: Avatar + Name + Date + Stars */}
              <div className="flex items-start gap-3">
                <Avatar name={review.customerName} url={review.customerAvatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-text text-sm leading-tight truncate">{review.customerName}</h3>
                      <p className="text-[11px] text-muted mt-0.5">
                        {new Date(review.createdAt).toLocaleDateString('en-PK', {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg shrink-0">
                      <Icon name="star" size={12} className="text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-amber-500">{review.rating}/5</span>
                    </div>
                  </div>
                  <StarDisplay rating={review.rating} />
                </div>
              </div>

              {/* Review Text */}
              <p className="text-sm text-muted leading-relaxed bg-raised/60 rounded-xl p-3 border border-line/50 italic">
                &ldquo;{review.reviewText}&rdquo;
              </p>

              {/* Status Badges + Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-line">
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    review.isApproved
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    {review.isApproved ? 'Approved' : 'Pending'}
                  </span>
                  {review.isFeatured && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                      Featured
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleFeatureToggle(review)}
                    title={review.isFeatured ? 'Unpin from homepage' : 'Pin to homepage'}
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      review.isFeatured
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface text-muted hover:text-text border-line hover:border-primary/30'
                    }`}
                  >
                    {review.isFeatured ? 'Unpin' : 'Pin'}
                  </button>

                  <button
                    onClick={() => handleApproveToggle(review)}
                    title={review.isApproved ? 'Move back to pending' : 'Approve for website'}
                    className={`h-8 px-2.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      review.isApproved
                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20'
                        : 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                    }`}
                  >
                    {review.isApproved ? 'Unapprove' : 'Approve'}
                  </button>

                  <button
                    onClick={() => handleDelete(review.id)}
                    title="Delete review"
                    className="w-8 h-8 rounded-lg bg-stop/10 text-stop border border-stop/20 flex items-center justify-center hover:bg-stop/20 transition-colors cursor-pointer"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-line shrink-0">
              <div>
                <h2 className="text-lg font-bold text-text">Add Review Manually</h2>
                <p className="text-xs text-muted mt-0.5">Will be published immediately as approved.</p>
              </div>
              <button
                onClick={() => { setShowAddModal(false); resetModal(); }}
                className="w-8 h-8 rounded-xl bg-raised flex items-center justify-center text-muted hover:text-text transition-colors cursor-pointer"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleManualSubmit} className="overflow-y-auto flex-1">
              <div className="px-6 py-5 space-y-5">

                {/* Avatar Upload */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">
                    Customer Photo <span className="text-muted/60 font-normal normal-case">(optional)</span>
                  </label>
                  <AvatarUpload
                    previewBase64={newAvatarBase64}
                    onFileChange={setNewAvatarBase64}
                    onClear={() => setNewAvatarBase64(null)}
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-line/60" />

                {/* Customer Name */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                    Customer Name <span className="text-stop">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border border-line bg-raised text-sm text-text placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary outline-none font-medium"
                    placeholder="e.g., Ali Khan"
                    required
                  />
                </div>

                {/* Star Rating */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2.5">
                    Rating <span className="text-stop">*</span>
                  </label>
                  <StarPicker value={newRating} onChange={setNewRating} />
                </div>

                {/* Review Text */}
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-2">
                    Review Comment <span className="text-stop">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    className="w-full p-4 rounded-xl border border-line bg-raised text-sm text-text placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary outline-none leading-relaxed resize-none font-medium"
                    placeholder="Write the customer's review here..."
                    required
                  />
                </div>

                {/* Featured Checkbox */}
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-line bg-raised cursor-pointer hover:border-primary/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={newIsFeatured}
                    onChange={(e) => setNewIsFeatured(e.target.checked)}
                    className="w-4 h-4 rounded text-primary border-line focus:ring-primary cursor-pointer"
                  />
                  <div>
                    <p className="text-sm font-bold text-text">Pin as Featured</p>
                    <p className="text-[11px] text-muted">Show in the homepage reviews section</p>
                  </div>
                </label>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-line flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetModal(); }}
                  className="px-5 py-2.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-text transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? 'Publishing...' : 'Save & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
