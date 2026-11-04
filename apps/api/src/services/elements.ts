import {
  assignmentsFromFlatOrder,
  createElementBodySchema,
  createImageElementsBatchBodySchema,
  flattenPageElements,
  indexAfterSectionBlock,
  reorderElementsBodySchema,
  updateElementBodySchema,
  type PageElement,
} from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getOwnedPage } from "./pages.js";
import { assertOwnedImage, registerImage } from "./storage.js";

async function assertSectionInPage(
  pageId: string,
  sectionId: string,
): Promise<void> {
  const { data, error } = await db
    .from("page_elements")
    .select("id, type")
    .eq("id", sectionId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load section");
  }

  if (!data || data.type !== "section") {
    throw new HttpError(400, "Invalid section");
  }
}

async function loadPageElements(pageId: string): Promise<PageElement[]> {
  const { data, error } = await db
    .from("page_elements")
    .select("*")
    .eq("page_id", pageId)
    .order("position", { ascending: true });

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load elements");
  }

  return data ?? [];
}

async function applyFlatOrder(
  pageId: string,
  flatIds: string[],
  elements: PageElement[],
): Promise<void> {
  const byId = new Map(elements.map((element) => [element.id, element]));
  const assignments = assignmentsFromFlatOrder(flatIds, byId);

  if (assignments.length !== flatIds.length) {
    throw new HttpError(400, "Invalid element order");
  }

  const updates = assignments.map((assignment) =>
    db
      .from("page_elements")
      .update({
        parent_id: assignment.parent_id,
        position: assignment.position,
      })
      .eq("id", assignment.id)
      .eq("page_id", pageId),
  );

  const results = await Promise.all(updates);
  const updateError = results.find((result) => result.error)?.error;
  if (updateError) {
    console.error(updateError);
    throw new HttpError(500, "Failed to reorder elements");
  }
}

export async function createElement(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageElement> {
  await getOwnedPage(uid, pageId);
  const parsed = createElementBodySchema.parse(body);
  const existing = await loadPageElements(pageId);
  const flat = flattenPageElements(existing).map((element) => element.id);
  const byId = new Map(existing.map((element) => [element.id, element]));

  if (parsed.type === "section") {
    const { data, error } = await db
      .from("page_elements")
      .insert({
        page_id: pageId,
        type: "section",
        position: 0,
        text: parsed.text,
        parent_id: null,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Failed to create element");
    }

    const nextFlat = [...flat, data.id];
    await applyFlatOrder(pageId, nextFlat, [...existing, data]);
    const updated = (await loadPageElements(pageId)).find(
      (element) => element.id === data.id,
    );
    return updated ?? data;
  }

  if (parsed.target_section_id) {
    await assertSectionInPage(pageId, parsed.target_section_id);
  }

  const insertAt =
    parsed.target_section_id === undefined
      ? flat.length
      : indexAfterSectionBlock(flat, parsed.target_section_id, byId) + 1;

  if (parsed.type === "image") {
    await assertOwnedImage(uid, parsed.image_path);

    const imageId = await registerImage(uid, parsed.image_path, {
      taken_at: parsed.taken_at,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
    });

    const { data, error } = await db
      .from("page_elements")
      .insert({
        page_id: pageId,
        type: "image",
        position: 0,
        parent_id: null,
        image_path: parsed.image_path,
        image_id: imageId,
        caption: parsed.caption ?? "",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Failed to create element");
    }

    const nextFlat = [
      ...flat.slice(0, insertAt),
      data.id,
      ...flat.slice(insertAt),
    ];
    await applyFlatOrder(pageId, nextFlat, [...existing, data]);
    const updated = (await loadPageElements(pageId)).find(
      (element) => element.id === data.id,
    );
    return updated ?? data;
  }

  const { data, error } = await db
    .from("page_elements")
    .insert({
      page_id: pageId,
      type: "text",
      position: 0,
      parent_id: null,
      text: parsed.text,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to create element");
  }

  const nextFlat = [
    ...flat.slice(0, insertAt),
    data.id,
    ...flat.slice(insertAt),
  ];
  await applyFlatOrder(pageId, nextFlat, [...existing, data]);
  const updated = (await loadPageElements(pageId)).find(
    (element) => element.id === data.id,
  );
  return updated ?? data;
}

export async function createImageElements(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageElement[]> {
  await getOwnedPage(uid, pageId);
  const parsed = createImageElementsBatchBodySchema.parse(body);
  const existing = await loadPageElements(pageId);
  const flat = flattenPageElements(existing).map((element) => element.id);
  const byId = new Map(existing.map((element) => [element.id, element]));

  if (parsed.target_section_id) {
    await assertSectionInPage(pageId, parsed.target_section_id);
  }

  const insertAt =
    parsed.target_section_id === undefined
      ? flat.length
      : indexAfterSectionBlock(flat, parsed.target_section_id, byId) + 1;

  const sorted = [...parsed.images].sort(
    (a, b) =>
      new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime(),
  );

  const created: PageElement[] = [];

  for (const item of sorted) {
    await assertOwnedImage(uid, item.image_path);
    const imageId = await registerImage(uid, item.image_path, {
      taken_at: item.taken_at,
      latitude: item.latitude,
      longitude: item.longitude,
    });

    const { data, error } = await db
      .from("page_elements")
      .insert({
        page_id: pageId,
        type: "image",
        position: 0,
        parent_id: null,
        image_path: item.image_path,
        image_id: imageId,
        caption: item.caption ?? "",
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      throw new HttpError(500, "Failed to create element");
    }

    created.push(data);
  }

  const newIds = created.map((element) => element.id);
  const nextFlat = [
    ...flat.slice(0, insertAt),
    ...newIds,
    ...flat.slice(insertAt),
  ];
  await applyFlatOrder(pageId, nextFlat, [...existing, ...created]);

  const reloaded = await loadPageElements(pageId);
  const createdIds = new Set(newIds);
  return reloaded.filter((element) => createdIds.has(element.id));
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
    if (existing.type !== "text" && existing.type !== "section") {
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

  if (new Set(parsed.element_ids).size !== parsed.element_ids.length) {
    throw new HttpError(400, "Invalid element order");
  }

  const existing = await loadPageElements(pageId);
  const existingIds = new Set(existing.map((element) => element.id));

  if (
    parsed.element_ids.length !== existingIds.size ||
    parsed.element_ids.some((id) => !existingIds.has(id))
  ) {
    throw new HttpError(400, "Invalid element order");
  }

  await applyFlatOrder(pageId, parsed.element_ids, existing);
  return loadPageElements(pageId);
}

export async function deleteElement(
  uid: string,
  pageId: string,
  elementId: string,
): Promise<PageElement[]> {
  await getOwnedPage(uid, pageId);

  const { data: existing, error: loadError } = await db
    .from("page_elements")
    .select("id")
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

  const { error } = await db
    .from("page_elements")
    .delete()
    .eq("id", elementId)
    .eq("page_id", pageId);

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to delete element");
  }

  const remaining = await loadPageElements(pageId);
  if (remaining.length === 0) {
    return remaining;
  }

  const flat = flattenPageElements(remaining).map((element) => element.id);
  await applyFlatOrder(pageId, flat, remaining);
  return loadPageElements(pageId);
}
