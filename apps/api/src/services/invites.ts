import type { InvitePreview, Page } from "@ww/types";

import { db } from "../db.js";
import { HttpError } from "../http.js";

export async function getInvitePreview(token: string): Promise<InvitePreview> {
  const { data, error } = await db
    .from("pages")
    .select("name")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) {
    console.error(error);
    throw new HttpError(500, "Failed to load invite");
  }

  if (!data) {
    throw new HttpError(404, "Invite not found");
  }

  return { page_name: data.name };
}

export async function joinPageByInvite(
  uid: string,
  token: string,
): Promise<Page> {
  const { data: page, error: pageError } = await db
    .from("pages")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();

  if (pageError) {
    console.error(pageError);
    throw new HttpError(500, "Failed to join page");
  }

  if (!page) {
    throw new HttpError(404, "Invite not found");
  }

  const { error: memberError } = await db.from("page_members").upsert(
    {
      page_id: page.id,
      user_id: uid,
      added_by: null,
    },
    { onConflict: "page_id,user_id", ignoreDuplicates: true },
  );

  if (memberError) {
    console.error(memberError);
    throw new HttpError(500, "Failed to join page");
  }

  return page;
}
