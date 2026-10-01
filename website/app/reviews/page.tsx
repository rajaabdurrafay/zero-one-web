'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPublicReviews, type Review } from '@/lib/api';
import { Icon } from '@/components/Icon';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState({ totalReviews: 0, averageRating: 5.0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicReviews()
      .then((data) => {
        setReviews(data.reviews);
        setStats(data.stats);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12 sm:space-y-16 pb-20 pt-24 sm:pt-28">
      {/* Top Banner Header */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-surface-raised border border-brand-border text-xs font-semibold text-brand-text-muted">
          <Icon name="star" size={13} className="text-amber-500 fill-amber-500" />
          <span>Ratings & Testimonials</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-brand-text-main tracking-tight leading-[0.95]">
          Customer Experiences at <br />
          <span className="text-brand-primary">ZeroOne Cue & Play</span>
        </h1>
        <p className="text-brand-text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Real feedback from snooker players, console squads, and movie lovers in Karachi.
        </p>

        {/* Global Average Rating Card */}
        {stats.totalReviews > 0 && (
          <div className="pt-4 flex items-center justify-center">
            <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-5 sm:p-6 rounded-3xl bg-brand-surface border border-brand-border shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-4xl sm:text-5xl font-black text-brand-text-main tracking-tight">
                  {stats.averageRating}
                </span>
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon
                        key={star}
                        name="star"
                        size={16}
                        className={star <= Math.round(stats.averageRating) ? 'text-amber-500 fill-amber-500' : 'text-brand-text-muted/30'}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-brand-text-muted mt-1">Overall Rating</span>
                </div>
              </div>
              <div className="hidden sm:block w-px h-10 bg-brand-border" />
              <div className="text-sm font-semibold text-brand-text-muted">
                Based on <span className="text-brand-text-main font-bold">{stats.totalReviews}</span> verified player reviews
              </div>
              <Link
                href="/review"
                className="px-5 py-2.5 rounded-full bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover transition-colors shadow-xs"
              >
                Write a Review
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Reviews Grid */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-20 bg-brand-surface border border-brand-border rounded-3xl text-brand-text-muted text-sm space-y-4">
            <p>No customer reviews have been published yet.</p>
            <div>
              <Link
                href="/review"
                className="inline-flex px-6 py-3 rounded-full bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary-hover transition-colors shadow-xs"
              >
                Be the First to Review
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="p-7 rounded-3xl bg-brand-surface border border-brand-border flex flex-col justify-between space-y-6 shadow-xs"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Icon
                          key={star}
                          name="star"
                          size={16}
                          className={star <= review.rating ? 'text-amber-500 fill-amber-500' : 'text-brand-text-muted/30'}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-brand-text-muted">
                      {new Date(review.createdAt).toLocaleDateString('en-PK', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  <p className="text-sm text-brand-text-muted leading-relaxed font-normal italic">
                    &ldquo;{review.reviewText}&rdquo;
                  </p>
                </div>

                <div className="pt-4 border-t border-brand-border flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text-main">{review.customerName}</h4>
                    <span className="text-[11px] text-brand-text-muted">Verified Customer</span>
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
        )}
      </section>
    </div>
  );
}

