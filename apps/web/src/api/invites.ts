import type { InvitePreview, Page } from "@ww/types";

import { apiFetch, apiFetchPublic } from "./client.js";

export function fetchInvitePreview(token: string): Promise<InvitePreview> {
  return apiFetchPublic<InvitePreview>(`/api/invites/${token}`);
}

export function joinPageByInvite(
  token: string,
  accessToken: string,
): Promise<Page> {
  return apiFetch<Page>(`/api/invites/${token}/join`, accessToken, {
    method: "POST",
  });
}
