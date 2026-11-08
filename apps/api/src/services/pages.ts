import {
  createPageBodySchema,
  updatePageBodySchema,
  type Page,
} from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";

function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}

export async function createPage(uid: string, body: unknown): Promise<Page> {
  const parsed = createPageBodySchema.parse(body);

  const { data, error } = await db
    .from("pages")
    .insert({ owner_id: uid, name: parsed.name, tag: parsed.tag })
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Tag is already taken");
    }
    console.error(error);
    throw new HttpError(500, "Failed to create page");
  }

  return data;
}

export async function getOwnedPage(
  uid: string,
  pageId: string,
): Promise<Page> {
  const { data, error } = await db
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .eq("owner_id", uid)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load page");
  }

  if (!data) {
    throw new HttpError(404, "Page not found");
  }

  return data;
}

export async function updatePage(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<Page> {
  await getOwnedPage(uid, pageId);
  const parsed = updatePageBodySchema.parse(body);

  const patch: { name?: string; tag?: string } = {};
  if (parsed.name !== undefined) {
    patch.name = parsed.name;
  }
  if (parsed.tag !== undefined) {
    patch.tag = parsed.tag;
  }

  const { data, error } = await db
    .from("pages")
    .update(patch)
    .eq("id", pageId)
    .eq("owner_id", uid)
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, "Tag is already taken");
    }
    console.error(error);
    throw new HttpError(500, "Failed to update page");
  }

  return data;
}
