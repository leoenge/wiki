import { useMemo, useState } from "react";

import type { Review } from "@ww/types";

import { displayName, useProfiles } from "../../api/profiles.js";
import {
  type ItemReviewSummary,
  useSaveReview,
} from "../../api/reviews.js";
import { useAuth } from "../../lib/auth/AuthProvider.js";
import { Button } from "../Button.js";
import {
  StarRating,
  formatStarAverage,
  ratingToStars,
} from "./StarRating.js";

type ItemReviewsProps = {
  pageId: string;
  itemId: string;
  summary: ItemReviewSummary | undefined;
};

function sortReviewsForDisplay(
  reviews: Review[],
  currentUserId: string,
): Review[] {
  const others = reviews.filter((row) => row.user_id !== currentUserId);
  const self = reviews.filter((row) => row.user_id === currentUserId);
  return [...others, ...self];
}

function ReviewForm({
  rating,
  comment,
  savePending,
  onRatingChange,
  onCommentChange,
  onSave,
  onCancel,
}: {
  rating: number | null;
  comment: string;
  savePending: boolean;
  onRatingChange: (rating: number | null) => void;
  onCommentChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3 py-1" data-swipe-exclude>
      <StarRating
        value={ratingToStars(rating)}
        interactive
        onChange={(stars) =>
          onRatingChange(stars === null ? null : Math.round(stars * 2))
        }
      />
      <input
        type="text"
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Short comment (optional)"
        className="bg-surface text-foreground placeholder:text-muted w-full rounded-xs px-3 py-2 text-base outline-none"
      />
      <div className="flex gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={savePending || (rating === null && !comment.trim())}
          onClick={onSave}
        >
          Save
        </Button>
        <Button type="button" variant="anonymous" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function ItemReviews({ pageId, itemId, summary }: ItemReviewsProps) {
  const { user, accessToken } = useAuth();
  const saveReview = useSaveReview(accessToken);
  const [formOpen, setFormOpen] = useState(false);

  const reviews = summary?.reviews ?? [];
  const userIds = useMemo(
    () => [...new Set(reviews.map((row) => row.user_id))],
    [reviews],
  );
  const { getProfile } = useProfiles(userIds);

  const ownReview = reviews.find((row) => row.user_id === user?.id);

  const [rating, setRating] = useState<number | null>(ownReview?.rating ?? null);
  const [comment, setComment] = useState(ownReview?.comment ?? "");

  function openForm() {
    setRating(ownReview?.rating ?? null);
    setComment(ownReview?.comment ?? "");
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function onSave() {
    const trimmedComment = comment.trim();
    const body = {
      rating,
      comment: trimmedComment ? trimmedComment : null,
    };

    await saveReview.mutateAsync({ pageId, itemId, body });
    setFormOpen(false);
  }

  const averageLabel = formatStarAverage(summary?.averageTenths ?? null);
  const ratingCount = summary?.ratingCount ?? 0;
  const sorted = user
    ? sortReviewsForDisplay(reviews, user.id)
    : reviews;

  const formBlock = formOpen ? (
    <ReviewForm
      rating={rating}
      comment={comment}
      savePending={saveReview.isPending}
      onRatingChange={setRating}
      onCommentChange={setComment}
      onSave={() => void onSave()}
      onCancel={closeForm}
    />
  ) : null;

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {averageLabel !== null && ratingCount > 0 ? (
          <span className="text-muted flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <StarRating
              value={ratingToStars(summary!.averageTenths!)}
              size={26}
            />
            <span>
              {averageLabel} average ({ratingCount}{" "}
              {ratingCount === 1 ? "rating" : "ratings"})
            </span>
          </span>
        ) : (
          <span className="text-muted text-sm">No reviews yet</span>
        )}
        {user && !ownReview && !formOpen ? (
          <button
            type="button"
            onClick={openForm}
            className="text-muted hover:text-foreground text-sm"
            data-swipe-exclude
          >
            Rate
          </button>
        ) : null}
      </div>

      {!ownReview ? formBlock : null}

      {sorted.length > 0 ? (
        <ul className="space-y-2">
          {sorted.map((row) => {
            const isOwn = user?.id === row.user_id;
            if (isOwn && formOpen) {
              return (
                <li key={row.id} className="text-sm leading-relaxed">
                  {formBlock}
                </li>
              );
            }

            const profile = getProfile(row.user_id);
            const name = profile
              ? displayName(profile)
              : displayName(profile, { loading: true });

            const body = (
              <>
                <span className="font-medium">{name || "\u00a0"}</span>
                {row.rating !== null ? (
                  <span className="text-muted ml-2 inline-flex align-middle">
                    <StarRating value={ratingToStars(row.rating)} />
                  </span>
                ) : null}
                {row.comment ? (
                  <p className="text-muted mt-0.5">{row.comment}</p>
                ) : null}
              </>
            );

            if (isOwn) {
              return (
                <li key={row.id} className="text-sm leading-relaxed">
                  <button
                    type="button"
                    onClick={openForm}
                    className="hover:bg-surface/80 -mx-2 w-full rounded-xs px-2 py-1 text-left"
                    data-swipe-exclude
                  >
                    {body}
                  </button>
                </li>
              );
            }

            return (
              <li key={row.id} className="text-sm leading-relaxed">
                {body}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
