import {
  assignmentsFromFlatOrder,
  flattenPageElements,
  pageDraftContentSchema,
  upsertPageDraftBodySchema,
  assertUniqueMapPlaceIds,
  type PageDraft,
  type PageDraftContent,
  type PageElement,
  type PageWithElements,
} from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getOwnedPage } from "./pages.js";
import {
  assertImagePathPrefix,
  assertOwnedImage,
  registerImage,
} from "./storage.js";

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

export async function getPageDraft(
  uid: string,
  pageId: string,
): Promise<PageDraft | null> {
  await getOwnedPage(uid, pageId);

  const { data, error } = await db
    .from("page_drafts")
    .select("*")
    .eq("page_id", pageId)
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load draft");
  }

  return data;
}

export async function upsertPageDraft(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageDraft> {
  await getOwnedPage(uid, pageId);
  const parsed = upsertPageDraftBodySchema.parse(body);
  validateDraftContent(parsed, uid);

  const { data, error } = await db
    .from("page_drafts")
    .upsert(
      {
        page_id: pageId,
        user_id: uid,
        content: parsed,
      },
      { onConflict: "page_id,user_id" },
    )
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to save draft");
  }

  return data;
}

export async function discardPageDraft(
  uid: string,
  pageId: string,
): Promise<void> {
  await getOwnedPage(uid, pageId);

  const { error } = await db
    .from("page_drafts")
    .delete()
    .eq("page_id", pageId)
    .eq("user_id", uid);

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to discard draft");
  }
}

function validateDraftContent(content: PageDraftContent, uid: string): void {
  const ids = new Set<string>();

  for (const element of content.elements) {
    if (ids.has(element.id)) {
      throw new HttpError(400, "Invalid draft content");
    }
    ids.add(element.id);

    if (element.type === "image") {
      if (!element.image_path) {
        throw new HttpError(400, "Invalid draft content");
      }
      assertImagePathPrefix(uid, element.image_path);
    }

    if (element.type === "map") {
      if (!element.places) {
        throw new HttpError(400, "Invalid draft content");
      }
      try {
        assertUniqueMapPlaceIds(element.places);
      } catch {
        throw new HttpError(400, "Invalid draft content");
      }
    }
  }

  if (content.main_image_path) {
    assertImagePathPrefix(uid, content.main_image_path);
  }
}

export async function publishPageDraft(
  uid: string,
  pageId: string,
): Promise<PageWithElements> {
  await getOwnedPage(uid, pageId);

  const { data: draftRow, error: draftError } = await db
    .from("page_drafts")
    .select("*")
    .eq("page_id", pageId)
    .eq("user_id", uid)
    .maybeSingle();

  if (draftError) {
    console.error(draftError);
    throw new HttpError(500, "Failed to load draft");
  }

  if (!draftRow) {
    throw new HttpError(404, "Draft not found");
  }

  const content = pageDraftContentSchema.parse(draftRow.content);
  validateDraftContent(content, uid);

  let mainImageId: string | null = null;
  if (content.main_image_path) {
    await assertOwnedImage(uid, content.main_image_path);
    mainImageId = await registerImage(uid, content.main_image_path, {
      taken_at: content.main_image_meta?.taken_at,
      latitude: content.main_image_meta?.latitude,
      longitude: content.main_image_meta?.longitude,
    });
  }

  const { data: updatedPage, error: pageError } = await db
    .from("pages")
    .update({
      main_image_path: content.main_image_path,
      main_image_id: mainImageId,
    })
    .eq("id", pageId)
    .eq("owner_id", uid)
    .select()
    .single();

  if (pageError) {
    console.error(pageError);
    throw new HttpError(500, "Failed to update page");
  }

  const existing = await loadPageElements(pageId);
  const draftIds = new Set(content.elements.map((element) => element.id));

  for (const element of existing) {
    if (!draftIds.has(element.id)) {
      const { error } = await db
        .from("page_elements")
        .delete()
        .eq("id", element.id)
        .eq("page_id", pageId);

      if (error) {
        console.error(error);
        throw new HttpError(500, "Failed to publish draft");
      }
    }
  }

  const imageIdByPath = new Map<string, string>();

  for (const element of content.elements) {
    if (element.type !== "image" || !element.image_path) {
      continue;
    }

    if (imageIdByPath.has(element.image_path)) {
      continue;
    }

    await assertOwnedImage(uid, element.image_path);
    const imageId = await registerImage(uid, element.image_path, {
      taken_at: element.image_meta?.taken_at,
      latitude: element.image_meta?.latitude,
      longitude: element.image_meta?.longitude,
    });
    imageIdByPath.set(element.image_path, imageId);
  }

  const existingIds = new Set(existing.map((element) => element.id));

  for (const element of content.elements) {
    const baseRow = {
      page_id: pageId,
      type: element.type,
      parent_id: element.parent_id,
      position: element.position,
      text:
        element.type === "text" || element.type === "section"
          ? (element.text ?? "")
          : null,
      image_path: element.type === "image" ? element.image_path! : null,
      caption: element.type === "image" ? (element.caption ?? "") : null,
      image_id:
        element.type === "image" && element.image_path
          ? (imageIdByPath.get(element.image_path) ?? null)
          : null,
      places: element.type === "map" ? element.places! : null,
    };

    if (existingIds.has(element.id)) {
      const { error } = await db
        .from("page_elements")
        .update(baseRow)
        .eq("id", element.id)
        .eq("page_id", pageId);

      if (error) {
        console.error(error);
        throw new HttpError(500, "Failed to publish draft");
      }
    } else {
      const { error } = await db.from("page_elements").insert({
        id: element.id,
        ...baseRow,
      });

      if (error) {
        console.error(error);
        throw new HttpError(500, "Failed to publish draft");
      }
    }
  }

  const asElements: PageElement[] = content.elements.map((element) => ({
    id: element.id,
    page_id: pageId,
    type: element.type,
    parent_id: element.parent_id,
    position: element.position,
    text: element.text,
    caption: element.caption ?? null,
    image_path: element.image_path ?? null,
    image_id: null,
    places: element.type === "map" ? (element.places ?? []) : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const flatIds = flattenPageElements(asElements).map((element) => element.id);
  await applyFlatOrder(pageId, flatIds, asElements);

  const { error: deleteDraftError } = await db
    .from("page_drafts")
    .delete()
    .eq("page_id", pageId)
    .eq("user_id", uid);

  if (deleteDraftError) {
    console.error(deleteDraftError);
    throw new HttpError(500, "Failed to clear draft");
  }

  return {
    page: updatedPage,
    elements: await loadPageElements(pageId),
  };
}
