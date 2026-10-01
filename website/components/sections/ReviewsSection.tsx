'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPublicReviews, type Review } from '@/lib/api';
import { Icon } from '@/components/Icon';

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ totalReviews: 0, averageRating: 5.0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicReviews({ featured: true, limit: 3 })
      .then((data) => {
        if (data.reviews.length > 0) {
          setReviews(data.reviews);
          setStats(data.stats);
        } else {
          getPublicReviews({ limit: 3 }).then((fallbackData) => {
            setReviews(fallbackData.reviews);
            setStats(fallbackData.stats);
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (!loading && reviews.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-text-muted">Customer Feedback</span>
            {stats.totalReviews > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-bold">
                <Icon name="star" size={11} className="fill-amber-500" />
                <span>{stats.averageRating} ({stats.totalReviews} Reviews)</span>
              </div>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-brand-text-main tracking-tight leading-tight">
            What Gamers Say
          </h2>
        </div>
        <div className="flex items-center gap-4 self-start sm:self-end">
          <Link
            href="/review"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary hover:underline"
          >
            <span>Leave a Review</span>
            <span>+</span>
          </Link>
          <Link
            href="/reviews"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-text-main hover:underline"
          >
            <span>View All</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      {/* Reviews Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="p-6 sm:p-8 rounded-3xl bg-brand-surface border border-brand-border flex flex-col justify-between space-y-6 shadow-xs hover:shadow-md transition-shadow"
          >
            <div className="space-y-4">
              {/* Star Rating Display */}
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Icon
                    key={star}
                    name="star"
                    size={14}
                    className={star <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-brand-text-muted/30'}
                  />
                ))}
              </div>

              <p className="text-xs sm:text-sm text-brand-text-muted leading-relaxed font-normal italic">
                &ldquo;{review.reviewText}&rdquo;
              </p>
            </div>

            <div className="pt-4 border-t border-brand-border flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-brand-text-main">{review.customerName}</h4>
                <span className="text-[10px] sm:text-[11px] text-brand-text-muted">Verified Customer</span>
              </div>
              {review.customerAvatarUrl ? (
                <img
                  src={review.customerAvatarUrl.startsWith('http') ? review.customerAvatarUrl : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}${review.customerAvatarUrl}`}
                  alt={review.customerName}
                  className="w-8 h-8 rounded-full object-cover border border-brand-border"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-surface-raised border border-brand-border flex items-center justify-center text-xs font-bold text-brand-primary">
                  {review.customerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
