import {
  pageDraftContentSchema,
  publishPageDraftBodySchema,
  upsertPageDraftBodySchema,
  type Json,
  type PageDraft,
  type PageDraftContent,
  type PageElementWithItems,
  type PageWithElements,
} from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getMemberPage } from "./pages.js";
import {
  assertImageUsableOnPage,
  registerImage,
} from "./storage.js";

async function loadPageElementsWithItems(
  pageId: string,
): Promise<PageElementWithItems[]> {
  const { data, error } = await db
    .from("page_elements")
    .select("*, items:page_element_items(*)")
    .eq("page_id", pageId)
    .order("position", { ascending: true })
    .order("position", {
      ascending: true,
      referencedTable: "page_element_items",
    });

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load elements");
  }

  return (data ?? []).map((row) => {
    const items = (row.items ?? []) as PageElementWithItems["items"];
    return {
      ...row,
      items: [...items].sort((a, b) => a.position - b.position),
    };
  });
}

export async function getPageDraft(
  uid: string,
  pageId: string,
): Promise<PageDraft | null> {
  await getMemberPage(uid, pageId);

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

async function validateDraftContent(
  content: PageDraftContent,
  uid: string,
  pageId: string,
): Promise<void> {
  for (const element of content.elements) {
    if (element.type === "image" && element.image_path) {
      await assertImageUsableOnPage(uid, pageId, element.image_path);
    }
  }

  if (content.main_image_path) {
    await assertImageUsableOnPage(uid, pageId, content.main_image_path);
  }
}

async function registerContentImages(
  uid: string,
  content: PageDraftContent,
): Promise<PageDraftContent> {
  let mainImageId: string | null = null;
  if (content.main_image_path) {
    mainImageId = await registerImage(uid, content.main_image_path, {
      taken_at: content.main_image_meta?.taken_at,
      latitude: content.main_image_meta?.latitude,
      longitude: content.main_image_meta?.longitude,
    });
  }

  const imageIdByPath = new Map<string, string>();
  const elements = [];

  for (const element of content.elements) {
    if (element.type !== "image" || !element.image_path) {
      elements.push(element);
      continue;
    }

    let imageId = imageIdByPath.get(element.image_path);
    if (!imageId) {
      imageId = await registerImage(uid, element.image_path, {
        taken_at: element.image_meta?.taken_at,
        latitude: element.image_meta?.latitude,
        longitude: element.image_meta?.longitude,
      });
      imageIdByPath.set(element.image_path, imageId);
    }

    elements.push({ ...element, image_id: imageId });
  }

  return {
    ...content,
    main_image_id: mainImageId,
    elements,
  };
}

export async function upsertPageDraft(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageDraft> {
  const page = await getMemberPage(uid, pageId);
  const parsed = upsertPageDraftBodySchema.parse(body);
  const { base_version: requestedBaseVersion, ...contentInput } = parsed;
  const content = pageDraftContentSchema.parse(contentInput);

  await validateDraftContent(content, uid, pageId);

  const { data: existing, error: existingError } = await db
    .from("page_drafts")
    .select("id, base_version")
    .eq("page_id", pageId)
    .eq("user_id", uid)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    throw new HttpError(500, "Failed to save draft");
  }

  let baseVersion: number;
  if (existing) {
    baseVersion = existing.base_version;
  } else {
    if (requestedBaseVersion > page.version) {
      throw new HttpError(400, "Invalid base version");
    }
    baseVersion = requestedBaseVersion;
  }

  const { data, error } = await db
    .from("page_drafts")
    .upsert(
      {
        page_id: pageId,
        user_id: uid,
        content: content as unknown as NonNullable<Json>,
        base_version: baseVersion,
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
  await getMemberPage(uid, pageId);

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

export async function publishPageDraft(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageWithElements> {
  await getMemberPage(uid, pageId);
  const { force = false } = publishPageDraftBodySchema.parse(body ?? {});

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
  await validateDraftContent(content, uid, pageId);
  const publishPayload = await registerContentImages(uid, content);

  const { data: result, error: publishError } = await db.rpc(
    "publish_page_draft",
    {
      p_page_id: pageId,
      p_user_id: uid,
      p_content: publishPayload as unknown as Json,
      p_force: force,
    },
  );

  if (publishError) {
    if (publishError.message.includes("DRAFT_NOT_FOUND")) {
      throw new HttpError(404, "Draft not found");
    }
    if (publishError.message.includes("NOT_A_MEMBER")) {
      throw new HttpError(404, "Page not found");
    }
    console.error(publishError);
    throw new HttpError(500, "Failed to publish draft");
  }

  const parsed = result as {
    conflict: boolean;
    version?: number;
    last_published_by?: string | null;
    last_published_at?: string | null;
  };

  if (parsed.conflict) {
    let publisherName = "Someone";
    if (parsed.last_published_by) {
      const { data: profile } = await db
        .from("profiles")
        .select("first_name")
        .eq("id", parsed.last_published_by)
        .maybeSingle();
      if (profile?.first_name) {
        publisherName = profile.first_name;
      }
    }

    throw new HttpError(409, "Page changed", {
      code: "PAGE_CHANGED",
      last_published_by: parsed.last_published_by
        ? { id: parsed.last_published_by, first_name: publisherName }
        : null,
      last_published_at: parsed.last_published_at ?? null,
    });
  }

  const { data: page, error: pageError } = await db
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (pageError) {
    console.error(pageError);
    throw new HttpError(500, "Failed to load page");
  }

  return {
    page,
    elements: await loadPageElementsWithItems(pageId),
  };
}
