import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  ImageMetadataFields,
  PageDraft,
  PageDraftContent,
  PageElementWithItems,
  PageWithElements,
} from "@ww/types";

import { apiFetch } from "./client.js";
import {
  pageByTagQueryKey,
  pageDraftQueryKey,
  pageElementsQueryKey,
} from "./queries.js";
import { supabase } from "../lib/supabase.js";

async function fetchPageDraft(pageId: string): Promise<PageDraft | null> {
  const { data, error } = await supabase
    .from("page_drafts")
    .select("*")
    .eq("page_id", pageId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function usePageDraft(pageId: string | undefined) {
  return useQuery({
    queryKey: pageId ? pageDraftQueryKey(pageId) : ["page-draft", "none"],
    queryFn: () => fetchPageDraft(pageId!),
    enabled: Boolean(pageId),
  });
}

export function useSavePageDraft(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      body,
      baseVersion,
    }: {
      pageId: string;
      body: PageDraftContent;
      baseVersion: number;
    }) =>
      apiFetch<PageDraft>(`/api/pages/${pageId}/draft`, accessToken!, {
        method: "PUT",
        body: JSON.stringify({ ...body, base_version: baseVersion }),
      }),
    onSuccess: (draft) => {
      queryClient.setQueryData(pageDraftQueryKey(draft.page_id), draft);
    },
  });
}

export function usePublishPageDraft(
  accessToken: string | undefined,
  pageTag: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      force = false,
    }: {
      pageId: string;
      force?: boolean;
    }) =>
      apiFetch<PageWithElements>(
        `/api/pages/${pageId}/draft/publish`,
        accessToken!,
        {
          method: "POST",
          body: JSON.stringify({ force }),
        },
      ),
    onSuccess: (result, variables) => {
      queryClient.setQueryData(pageByTagQueryKey(pageTag), result.page);
      queryClient.setQueryData(
        pageElementsQueryKey(variables.pageId),
        result.elements,
      );
      queryClient.setQueryData(pageDraftQueryKey(variables.pageId), null);
    },
  });
}

export function useDiscardPageDraft(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) =>
      apiFetch<void>(`/api/pages/${pageId}/draft`, accessToken!, {
        method: "DELETE",
      }),
    onSuccess: (_data, pageId) => {
      queryClient.setQueryData(pageDraftQueryKey(pageId), null);
    },
  });
}

export type { PageDraftContent, ImageMetadataFields, PageElementWithItems };
