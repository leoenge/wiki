import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CreatePageBody, Page, UpdatePageBody } from "@ww/types";

import { apiFetch } from "./client.js";
import { pageByTagQueryKey, pagesQueryKey } from "./queries.js";

export function createPage(
  accessToken: string,
  body: CreatePageBody,
): Promise<Page> {
  return apiFetch<Page>("/api/pages", accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updatePage(
  accessToken: string,
  pageId: string,
  body: UpdatePageBody,
): Promise<Page> {
  return apiFetch<Page>(`/api/pages/${pageId}`, accessToken, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function useCreatePage(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreatePageBody) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return createPage(accessToken, body);
    },
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: pagesQueryKey });
      void queryClient.invalidateQueries({
        queryKey: pageByTagQueryKey(page.tag),
      });
    },
  });
}

export function useUpdatePage(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      body,
    }: {
      pageId: string;
      body: UpdatePageBody;
      previousTag?: string;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return updatePage(accessToken, pageId, body);
    },
    onSuccess: (page, variables) => {
      void queryClient.invalidateQueries({ queryKey: pagesQueryKey });
      queryClient.setQueryData(pageByTagQueryKey(page.tag), page);
      const previousTag = variables.previousTag;
      if (previousTag && previousTag !== page.tag) {
        queryClient.removeQueries({ queryKey: pageByTagQueryKey(previousTag) });
      }
    },
  });
}
