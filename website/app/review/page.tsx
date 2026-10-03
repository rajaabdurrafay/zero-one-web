'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { submitPublicReview } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { useCustomerAuth } from '@/context/CustomerAuthContext';

export default function SubmitReviewPage() {
  const { customer } = useCustomerAuth();
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer?.name) {
      setName(customer.name);
    }
  }, [customer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (rating === 0) {
      setError('Please select a star rating.');
      return;
    }
    if (!reviewText.trim() || reviewText.trim().length < 5) {
      setError('Please write at least 5 characters for your review.');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitPublicReview({
        customerName: name.trim(),
        customerAvatarUrl: customer?.profilePictureUrl || null,
        rating,
        reviewText: reviewText.trim(),
      });
      setIsSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Icon name="check" size={40} />
        </div>
        <h1 className="zo-inner-title text-3xl sm:text-4xl font-black text-brand-text-main tracking-tight">
          Thank You!
        </h1>
        <p className="text-brand-text-muted text-sm sm:text-base leading-relaxed max-w-md mx-auto">
          Your review has been submitted successfully and is pending approval by our team. Once approved, it will appear on our website.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-sm font-bold text-white bg-brand-primary hover:bg-brand-primary-hover shadow-xs transition-colors w-full sm:w-auto"
          >
            Back to Home
          </Link>
          <Link
            href="/reviews"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-sm font-semibold border border-brand-border text-brand-text-main hover:bg-brand-surface-raised transition-colors w-full sm:w-auto"
          >
            Browse Reviews
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12 sm:py-20">
      <div className="max-w-xl w-full mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface-raised border border-brand-border text-xs font-semibold text-brand-text-muted">
            <Icon name="star" size={13} className="text-amber-500 fill-amber-500" />
            <span>Share Your Experience</span>
          </div>
          <h1 className="zo-inner-title text-3xl sm:text-5xl font-black text-brand-text-main tracking-tight leading-tight">
            Leave a Review
          </h1>
          <p className="text-brand-text-muted text-sm max-w-md mx-auto leading-relaxed">
            We value your feedback. Tell us how your experience at ZeroOne was. Your review will be published once approved.
          </p>
        </div>

        {/* Review Form Card */}
        <form
          onSubmit={handleSubmit}
          className="p-8 sm:p-10 rounded-3xl zo-panel bg-brand-surface border border-brand-border shadow-xs space-y-6"
        >
          {/* Name Field */}
          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-5 rounded-2xl border border-brand-border bg-brand-surface-raised text-sm text-brand-text-main placeholder:text-brand-text-muted/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none font-medium"
              placeholder="e.g., Ali Khan"
              required
            />
          </div>

          {/* Star Rating Interactive */}
          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-3">
              Star Rating
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center bg-brand-surface-raised border border-brand-border hover:border-amber-500/50 transition-colors cursor-pointer active:scale-95 select-none"
                  aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Icon
                    name="star"
                    size={28}
                    className={
                      star <= (hoverRating || rating)
                        ? 'text-amber-500 fill-amber-500 transition-colors'
                        : 'text-brand-text-muted/30 transition-colors'
                    }
                  />
                </button>
              ))}
              {rating > 0 && (
                <span className="text-sm font-bold text-brand-text-main ml-3">
                  {rating === 5 ? 'Excellent!' : rating === 4 ? 'Very Good' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
                </span>
              )}
            </div>
          </div>

          {/* Review Text */}
          <div>
            <label className="block text-xs font-bold text-brand-text-muted uppercase tracking-wider mb-2">
              Your Review
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={5}
              className="w-full p-5 rounded-2xl border border-brand-border bg-brand-surface-raised text-sm text-brand-text-main placeholder:text-brand-text-muted/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none leading-relaxed font-medium resize-none"
              placeholder="Tell us about your experience at ZeroOne..."
              required
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl bg-brand-primary text-white text-sm font-bold hover:bg-brand-primary-hover transition-colors shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
}
