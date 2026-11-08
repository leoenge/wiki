import { upsertReviewBodySchema, type Review } from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getMemberPage } from "./pages.js";

const REVIEWABLE_TYPES = new Set(["map", "review"]);

export async function upsertItemReview(
  uid: string,
  pageId: string,
  itemId: string,
  body: unknown,
): Promise<Review> {
  await getMemberPage(uid, pageId);
  const parsed = upsertReviewBodySchema.parse(body);

  const comment =
    parsed.comment === null ? null : parsed.comment.trim() || null;

  if (parsed.rating === null && comment === null) {
    throw new HttpError(400, "At least one of rating or comment is required");
  }

  const { data: item, error: itemError } = await db
    .from("page_element_items")
    .select("id, element_id")
    .eq("id", itemId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (itemError) {
    console.error(itemError);
    throw new HttpError(500, "Failed to load item");
  }

  if (!item) {
    throw new HttpError(404, "Item not found");
  }

  const { data: element, error: elementError } = await db
    .from("page_elements")
    .select("type")
    .eq("id", item.element_id)
    .eq("page_id", pageId)
    .maybeSingle();

  if (elementError) {
    console.error(elementError);
    throw new HttpError(500, "Failed to load element");
  }

  if (!element) {
    throw new HttpError(404, "Item not found");
  }

  const elementType = element.type;

  if (!REVIEWABLE_TYPES.has(elementType)) {
    throw new HttpError(400, "This item cannot be reviewed");
  }

  const { data: existing, error: existingError } = await db
    .from("reviews")
    .select("id, rating")
    .eq("item_id", itemId)
    .eq("user_id", uid)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    throw new HttpError(500, "Failed to load review");
  }

  if (
    existing &&
    existing.rating !== null &&
    parsed.rating === null
  ) {
    throw new HttpError(400, "A rating cannot be removed");
  }

  const row = {
    item_id: itemId,
    page_id: pageId,
    user_id: uid,
    rating: parsed.rating,
    comment,
  };

  const { data, error } = await db
    .from("reviews")
    .upsert(row, { onConflict: "item_id,user_id" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "P0001" || error.message?.includes("ITEM_NOT_REVIEWABLE")) {
      throw new HttpError(400, "This item cannot be reviewed");
    }
    console.error(error);
    throw new HttpError(500, "Failed to save review");
  }

  return data;
}
