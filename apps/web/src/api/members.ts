import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AddPageMemberBody, PageMemberAdded } from "@ww/types";

import { apiFetch } from "./client.js";

export function useAddPageMember(accessToken: string) {
  return useMutation({
    mutationFn: ({
      pageId,
      body,
    }: {
      pageId: string;
      body: AddPageMemberBody;
    }) =>
      apiFetch<PageMemberAdded>(`/api/pages/${pageId}/members`, accessToken, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });
}

export function useRemovePageMember(accessToken: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      userId,
    }: {
      pageId: string;
      userId: string;
    }) =>
      apiFetch<void>(
        `/api/pages/${pageId}/members/${userId}`,
        accessToken,
        { method: "DELETE" },
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["page-members", variables.pageId],
      });
    },
  });
}
