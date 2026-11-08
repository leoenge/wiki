import { postElementCommentBodySchema, type ElementComment } from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getMemberPage } from "./pages.js";

export async function postElementComment(
  uid: string,
  pageId: string,
  elementId: string,
  body: unknown,
): Promise<ElementComment> {
  await getMemberPage(uid, pageId);
  const parsed = postElementCommentBodySchema.parse(body);

  const { data: element, error: elementError } = await db
    .from("page_elements")
    .select("id, type")
    .eq("id", elementId)
    .eq("page_id", pageId)
    .maybeSingle();

  if (elementError) {
    console.error(elementError);
    throw new HttpError(500, "Failed to load element");
  }

  if (!element) {
    throw new HttpError(404, "Element not found");
  }

  if (element.type === "section") {
    throw new HttpError(400, "Sections cannot be commented on");
  }

  const { data, error } = await db
    .from("element_comments")
    .insert({
      element_id: elementId,
      page_id: pageId,
      user_id: uid,
      body: parsed.body,
    })
    .select("*")
    .single();

  if (error) {
    if (error.message?.includes("SECTION_CANNOT_BE_COMMENTED")) {
      throw new HttpError(400, "Sections cannot be commented on");
    }
    console.error(error);
    throw new HttpError(500, "Failed to post comment");
  }

  return data;
}
