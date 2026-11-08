import type { Review, UpsertReviewBody } from "@ww/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { apiFetch } from "./client.js";
import { supabase } from "../lib/supabase.js";

export type ItemReviewSummary = {
  ratingCount: number;
  averageTenths: number | null;
  reviews: Review[];
};

export function pageReviewsQueryKey(pageId: string) {
  return ["page-reviews", pageId] as const;
}

function summarizeReviews(rows: Review[]): Map<string, ItemReviewSummary> {
  const map = new Map<string, ItemReviewSummary>();

  for (const review of rows) {
    const existing = map.get(review.item_id) ?? {
      ratingCount: 0,
      averageTenths: null,
      reviews: [],
    };
    existing.reviews.push(review);
    map.set(review.item_id, existing);
  }

  for (const [itemId, summary] of map) {
    const withRating = summary.reviews.filter((row) => row.rating !== null);
    summary.ratingCount = withRating.length;
    if (withRating.length > 0) {
      const sum = withRating.reduce((acc, row) => acc + (row.rating ?? 0), 0);
      summary.averageTenths = sum / withRating.length;
    }
    summary.reviews.sort((a, b) => {
      if (a.user_id === b.user_id) {
        return 0;
      }
      return a.created_at.localeCompare(b.created_at);
    });
    map.set(itemId, summary);
  }

  return map;
}

async function fetchPageReviews(pageId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("page_id", pageId);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function usePageReviews(pageId: string | undefined) {
  const query = useQuery({
    queryKey: pageId ? pageReviewsQueryKey(pageId) : ["page-reviews", "none"],
    queryFn: () => fetchPageReviews(pageId!),
    enabled: Boolean(pageId),
  });

  const byItemId = useMemo(
    () => summarizeReviews(query.data ?? []),
    [query.data],
  );

  function reviewCountForItem(itemId: string): number {
    return byItemId.get(itemId)?.reviews.length ?? 0;
  }

  function removeNoteForItem(itemId: string): string | null {
    const count = reviewCountForItem(itemId);
    if (count === 0) {
      return null;
    }
    const label = count === 1 ? "review" : "reviews";
    return `This item has ${count} ${label} that will be deleted when you publish`;
  }

  function removeNoteForElement(itemIds: string[]): string | null {
    const total = itemIds.reduce((acc, id) => acc + reviewCountForItem(id), 0);
    if (total === 0) {
      return null;
    }
    const label = total === 1 ? "review" : "reviews";
    return `This element has ${total} ${label} that will be deleted when you publish`;
  }

  return {
    reviews: query.data ?? [],
    byItemId,
    isLoading: query.isLoading,
    reviewCountForItem,
    removeNoteForItem,
    removeNoteForElement,
  };
}

export function useSaveReview(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      itemId,
      body,
    }: {
      pageId: string;
      itemId: string;
      body: UpsertReviewBody;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return apiFetch<Review>(
        `/api/pages/${pageId}/items/${itemId}/review`,
        accessToken,
        {
          method: "PUT",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: (review) => {
      queryClient.setQueryData<Review[]>(
        pageReviewsQueryKey(review.page_id),
        (previous) => {
          const rows = previous ?? [];
          const index = rows.findIndex(
            (row) => row.item_id === review.item_id && row.user_id === review.user_id,
          );
          if (index < 0) {
            return [...rows, review];
          }
          const next = [...rows];
          next[index] = review;
          return next;
        },
      );
    },
  });
}
