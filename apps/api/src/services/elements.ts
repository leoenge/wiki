import {
  createElementBodySchema,
  reorderElementsBodySchema,
  updateElementBodySchema,
  type PageElement,
} from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getOwnedPage } from "./pages.js";
import { assertOwnedImage } from "./storage.js";

async function nextElementPosition(pageId: string): Promise<number> {
  const { data, error } = await db
    .from("page_elements")
    .select("position")
    .eq("page_id", pageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load elements");
  }

  return (data?.position ?? -1) + 1;
}

export async function createElement(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageElement> {
  await getOwnedPage(uid, pageId);
  const parsed = createElementBodySchema.parse(body);
  const position = await nextElementPosition(pageId);

  if (parsed.type === "image") {
    await assertOwnedImage(uid, parsed.image_path);

    const { data, error } = await db
      .from("page_elements")
      .insert({
        page_id: pageId,
        type: "image",
        position,
        image_path: parsed.image_path,
        caption: parsed.caption ?? "",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Failed to create element");
    }

    return data;
  }

  const { data, error } = await db
    .from("page_elements")
    .insert({
      page_id: pageId,
      type: "text",
      position,
      text: parsed.text,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to create element");
  }

  return data;
}

export async function updateElement(
  uid: string,
  pageId: string,
  elementId: string,
  body: unknown,
): Promise<PageElement> {
  await getOwnedPage(uid, pageId);
  const parsed = updateElementBodySchema.parse(body);

  const { data: existing, error: loadError } = await db
    .from("page_elements")
    .select("*")
    .eq("id", elementId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (loadError) {
    console.error(loadError);
    throw new HttpError(500, "Failed to load element");
  }

  if (!existing) {
    throw new HttpError(404, "Element not found");
  }

  if ("text" in parsed) {
    if (existing.type !== "text") {
      throw new HttpError(400, "Cannot update text on this element");
    }

    const { data, error } = await db
      .from("page_elements")
      .update({ text: parsed.text })
      .eq("id", elementId)
      .eq("page_id", pageId)
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Failed to update element");
    }

    return data;
  }

  if (existing.type !== "image") {
    throw new HttpError(400, "Cannot update caption on this element");
  }

  const { data, error } = await db
    .from("page_elements")
    .update({ caption: parsed.caption })
    .eq("id", elementId)
    .eq("page_id", pageId)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to update element");
  }

  return data;
}

export async function reorderElements(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageElement[]> {
  await getOwnedPage(uid, pageId);
  const parsed = reorderElementsBodySchema.parse(body);

  const { data: existing, error: loadError } = await db
    .from("page_elements")
    .select("id")
    .eq("page_id", pageId);

  if (loadError) {
    console.error(loadError);
    throw new HttpError(500, "Failed to load elements");
  }

  const existingIds = new Set((existing ?? []).map((row) => row.id));

  if (
    parsed.element_ids.length !== existingIds.size ||
    parsed.element_ids.some((id) => !existingIds.has(id))
  ) {
    throw new HttpError(400, "Invalid element order");
  }

  const updates = parsed.element_ids.map((id, index) =>
    db
      .from("page_elements")
      .update({ position: index })
      .eq("id", id)
      .eq("page_id", pageId),
  );

  const results = await Promise.all(updates);
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) {
    console.error(updateError);
    throw new HttpError(500, "Failed to reorder elements");
  }

  const { data, error } = await db
    .from("page_elements")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load elements");
  }

  return data;
}
