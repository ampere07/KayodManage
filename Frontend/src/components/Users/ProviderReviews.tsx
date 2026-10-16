import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useUserReviews } from '../../hooks/useUsers';
import ClickableImage from '../UI/ClickableImage';
import type { HistoryTarget } from './UserHistoryTabs';
import type { UserReview, UserReviewsSummary } from '../../types/users.types';

/**
 * A provider's ratings as their clients left them, behind the Reviews tab:
 * the summary, star filters and the full list.
 * Data: GET /api/users/:id/reviews (client → provider reviews only).
 */

export const Stars: React.FC<{ value: number; size?: 'sm' | 'md' | 'lg' }> = ({ value, size = 'sm' }) => {
  const px = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5' }[size];
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${px} ${star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-200'}`}
        />
      ))}
    </span>
  );
};

const relative = (value: string) => formatDistanceToNowStrict(new Date(value), { addSuffix: true });
const fullDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Average, star distribution and per-category averages. Bars filter the list when `onPickStar` is given. */
export const RatingSummary: React.FC<{
  summary: UserReviewsSummary;
  /** The running average stored on the user, shown when it disagrees with the reviews. */
  storedRating?: number;
  activeStar?: number | null;
  onPickStar?: (star: number | null) => void;
}> = ({ summary, storedRating, activeStar, onPickStar }) => {
  const drift = storedRating != null && summary.count > 0 && Math.abs(storedRating - summary.average) >= 0.1;

  return (
    <div className="space-y-4" data-testid="provider-rating-summary">
      <div className="flex items-center gap-5">
        <div className="text-center flex-shrink-0">
          <p className="text-4xl font-black text-gray-900 leading-none">{summary.count ? summary.average.toFixed(1) : '—'}</p>
          <div className="mt-1.5"><Stars value={summary.average} size="md" /></div>
          <p className="text-[11px] text-gray-500 mt-1">
            {summary.count} review{summary.count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[String(star)] || 0;
            const pct = summary.count ? Math.round((count / summary.count) * 100) : 0;
            const active = activeStar === star;
            const Row = onPickStar ? 'button' : 'div';
            return (
              <Row
                key={star}
                {...(onPickStar ? { type: 'button' as const, onClick: () => onPickStar(active ? null : star), 'aria-pressed': active } : {})}
                className={`w-full flex items-center gap-2 text-[11px] rounded ${onPickStar ? 'hover:bg-gray-50 px-1 -mx-1' : ''} ${active ? 'bg-amber-50' : ''}`}
                data-testid={`rating-bar-${star}`}
              >
                <span className="w-3 font-bold text-gray-600">{star}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="w-7 text-right text-gray-500 tabular-nums">{count}</span>
              </Row>
            );
          })}
        </div>
      </div>

      {summary.categories.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {summary.categories.map((category) => (
            <div key={category.key}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gray-600 truncate">{category.label}</span>
                <span className="font-bold text-gray-900">{category.average.toFixed(1)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                <div className="h-full rounded-full bg-indigo-400" style={{ width: `${(category.average / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {drift && (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          The app shows <span className="font-bold text-gray-700">{storedRating!.toFixed(1)}</span> on this provider’s
          profile — the running average stored on the account, which differs from the {summary.average.toFixed(1)} these
          reviews add up to.
        </p>
      )}
    </div>
  );
};

export const ReviewRow: React.FC<{ review: UserReview; onOpenJob?: (jobId: string) => void }> = ({ review, onOpenJob }) => (
  <li className="py-3" data-testid={`provider-review-${review._id}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Stars value={review.rating} />
          <span className="text-xs font-bold text-gray-900">{review.rating.toFixed(0)}/5</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          <span className="font-semibold text-gray-900">{review.client?.name || 'Deleted client'}</span>
          {review.job && (
            <>
              {' · '}
              {onOpenJob ? (
                <button type="button" onClick={() => onOpenJob(review.job!._id)} className="text-blue-600 hover:underline">
                  {review.job.title}
                </button>
              ) : (
                review.job.title
              )}
            </>
          )}
        </p>
      </div>
      <span className="text-[11px] text-gray-400 flex-shrink-0" title={fullDate(review.createdAt)}>{relative(review.createdAt)}</span>
    </div>

    {review.review ? (
      <p className="text-sm text-gray-800 mt-2 whitespace-pre-line">“{review.review}”</p>
    ) : (
      <p className="text-xs text-gray-400 italic mt-2">No written comment.</p>
    )}

    {review.categoryRatings.length > 0 && (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {review.categoryRatings.map((category) => (
          <span key={category.key} className="text-[10px] font-semibold text-gray-600 bg-gray-50 border border-gray-100 rounded px-1.5 py-0.5">
            {category.label || category.key} <span className="text-gray-900">{category.value}</span>
          </span>
        ))}
      </div>
    )}

    {review.images.length > 0 && (
      <div className="flex gap-2 mt-2">
        {review.images.slice(0, 4).map((src, index) => (
          <div key={src} className="w-14 h-14 rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
            <ClickableImage src={src} alt={`Review photo ${index + 1}`} className="w-full h-full object-cover" showFullscreenHint={false} />
          </div>
        ))}
        {review.images.length > 4 && <span className="text-[11px] text-gray-500 self-center">+{review.images.length - 4}</span>}
      </div>
    )}
  </li>
);

/** The Reviews tab: every review, filterable by star value, ten per page. */
export const UserReviewsTab: React.FC<{
  userId: string;
  storedRating?: number;
  onOpenTarget?: (target: HistoryTarget) => void;
}> = ({ userId, storedRating, onOpenTarget }) => {
  const [star, setStar] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useUserReviews(userId, { page, limit: 10, ...(star ? { rating: star } : {}) });
  const openJob = onOpenTarget ? (jobId: string) => onOpenTarget({ type: 'job', id: jobId }) : undefined;
  const pickStar = (next: number | null) => {
    setStar(next);
    setPage(1);
  };

  if (isLoading && !data) {
    return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }
  if (isError) return <p className="text-center text-sm text-gray-500 py-10">Could not load this provider’s reviews.</p>;
  if (!data || data.summary.count === 0) {
    return <p className="text-center text-sm text-gray-500 py-10">No client has reviewed this provider yet.</p>;
  }

  return (
    <div className="space-y-4" data-testid="user-reviews-tab">
      <RatingSummary summary={data.summary} storedRating={storedRating} activeStar={star} onPickStar={pickStar} />

      <div className="sticky top-0 z-10 bg-white -mx-4 md:-mx-6 px-4 md:px-6 py-3 flex flex-wrap gap-1.5 border-b border-gray-100">
        {[null, 5, 4, 3, 2, 1].map((value) => (
          <button
            key={value ?? 'all'}
            type="button"
            onClick={() => pickStar(value)}
            data-testid={`reviews-filter-${value ?? 'all'}`}
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full border transition-colors ${
              star === value ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {value ? `${value}★ · ${data.summary.distribution[String(value)] || 0}` : `All · ${data.summary.count}`}
          </button>
        ))}
      </div>

      {data.reviews.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {data.reviews.map((review) => <ReviewRow key={review._id} review={review} onOpenJob={openJob} />)}
        </ul>
      ) : (
        <p className="text-center text-sm text-gray-500 py-6">No {star}-star reviews.</p>
      )}

      {data.pagination.pages > 1 && (
        <div className="sticky bottom-0 z-10 bg-white -mx-4 md:-mx-6 -mb-6 px-4 md:px-6 py-3 flex items-center justify-between border-t border-gray-100">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
          >
            Previous
          </button>
          <span className="text-[11px] font-medium text-gray-500">Page {page} of {data.pagination.pages}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= data.pagination.pages}
            className="px-3 py-1.5 text-xs font-bold text-gray-600 rounded border border-gray-200 disabled:opacity-40 hover:border-gray-400"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
