import type { PageElementWithItems } from "@ww/types";

import { type ItemReviewSummary } from "../../api/reviews.js";
import { ItemReviews } from "./ItemReviews.js";

type ReviewElementViewProps = {
  element: PageElementWithItems;
  pageId: string;
  byItemId: Map<string, ItemReviewSummary>;
};

export function ReviewElementView({
  element,
  pageId,
  byItemId,
}: ReviewElementViewProps) {
  const items = element.items ?? [];
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 py-2">
      {items.map((item) => (
        <div key={item.id}>
          <p className="text-lg font-medium">{item.label}</p>
          <ItemReviews
            pageId={pageId}
            itemId={item.id}
            summary={byItemId.get(item.id)}
          />
        </div>
      ))}
    </div>
  );
}
