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

export async function getMemberPage(
  uid: string,
  pageId: string,
): Promise<Page> {
  const { data: membership, error: memberError } = await db
    .from("page_members")
    .select("page_id")
    .eq("page_id", pageId)
    .eq("user_id", uid)
    .maybeSingle();

  if (memberError) {
    console.error(memberError);
    throw new HttpError(500, "Failed to load page");
  }

  if (!membership) {
    throw new HttpError(404, "Page not found");
  }

  const { data, error } = await db
    .from("pages")
    .select("*")
    .eq("id", pageId)
    .single();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load page");
  }

  return data;
}

export async function createPage(uid: string, body: unknown): Promise<Page> {
  const parsed = createPageBodySchema.parse(body);

  const { data, error } = await db
    .from("pages")
    // invite_token defaults in the database.
    .insert({
      created_by: uid,
      name: parsed.name,
      tag: parsed.tag,
    } as never)
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

export async function updatePage(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<Page> {
  await getMemberPage(uid, pageId);
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
