import { addPageMemberBodySchema, type PageMemberAdded } from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";
import { getMemberPage } from "./pages.js";

export async function addPageMemberByEmail(
  uid: string,
  pageId: string,
  body: unknown,
): Promise<PageMemberAdded> {
  await getMemberPage(uid, pageId);
  const parsed = addPageMemberBodySchema.parse(body);
  const email = parsed.email.trim().toLowerCase();

  const { data: targetUserId, error: lookupError } = await db.rpc(
    "find_user_id_by_email",
    { p_email: email },
  );

  if (lookupError) {
    console.error(lookupError);
    throw new HttpError(500, "Failed to look up user");
  }

  if (!targetUserId) {
    throw new HttpError(404, "No account with that email");
  }

  const { data: existing, error: existingError } = await db
    .from("page_members")
    .select("user_id")
    .eq("page_id", pageId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existingError) {
    console.error(existingError);
    throw new HttpError(500, "Failed to add member");
  }

  if (existing) {
    throw new HttpError(409, "Already a member");
  }

  const { error: insertError } = await db.from("page_members").insert({
    page_id: pageId,
    user_id: targetUserId,
    added_by: uid,
  });

  if (insertError) {
    console.error(insertError);
    throw new HttpError(500, "Failed to add member");
  }

  const { data: profile, error: profileError } = await db
    .from("profiles")
    .select("first_name")
    .eq("id", targetUserId)
    .single();

  if (profileError) {
    console.error(profileError);
    throw new HttpError(500, "Failed to load member");
  }

  const { data: memberRow, error: memberError } = await db
    .from("page_members")
    .select("created_at")
    .eq("page_id", pageId)
    .eq("user_id", targetUserId)
    .single();

  if (memberError) {
    console.error(memberError);
    throw new HttpError(500, "Failed to load member");
  }

  return {
    user_id: targetUserId,
    first_name: profile.first_name,
    created_at: memberRow.created_at,
  };
}

export async function removePageMember(
  uid: string,
  pageId: string,
  targetUserId: string,
): Promise<void> {
  await getMemberPage(uid, pageId);

  const { error } = await db.rpc("remove_page_member", {
    p_page_id: pageId,
    p_user_id: targetUserId,
  });

  if (!error) {
    return;
  }

  if (error.message.includes("PAGE_NEEDS_MEMBER")) {
    throw new HttpError(409, "A page needs at least one member");
  }

  console.error(error);
  throw new HttpError(500, "Failed to remove member");
}
