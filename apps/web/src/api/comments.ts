import type { ElementComment, PostElementCommentBody } from "@ww/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { apiFetch } from "./client.js";
import { supabase } from "../lib/supabase.js";

export function elementCommentsQueryKey(pageId: string, elementId: string) {
  return ["element-comments", pageId, elementId] as const;
}

export function pageCommentCountsQueryKey(pageId: string) {
  return ["page-comment-counts", pageId] as const;
}

async function fetchElementComments(elementId: string): Promise<ElementComment[]> {
  const { data, error } = await supabase
    .from("element_comments")
    .select("*")
    .eq("element_id", elementId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

type CommentCountRow = {
  page_id: string;
  element_id: string;
  count: number;
};

async function fetchPageCommentCounts(pageId: string): Promise<CommentCountRow[]> {
  const { data, error } = await supabase
    .from("element_comment_counts")
    .select("*")
    .eq("page_id", pageId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    page_id: row.page_id,
    element_id: row.element_id,
    count: Number(row.count),
  }));
}

export function useElementComments(
  pageId: string | undefined,
  elementId: string | undefined,
) {
  const queryClient = useQueryClient();
  const queryKey =
    pageId && elementId
      ? elementCommentsQueryKey(pageId, elementId)
      : ["element-comments", "none"];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchElementComments(elementId!),
    enabled: Boolean(pageId && elementId),
  });

  useEffect(() => {
    if (!pageId || !elementId) {
      return;
    }

    const channel = supabase
      .channel(`element-comments:${elementId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "element_comments",
          filter: `element_id=eq.${elementId}`,
        },
        (payload) => {
          const row = payload.new as ElementComment;
          queryClient.setQueryData<ElementComment[]>(queryKey, (previous) => {
            const rows = previous ?? [];
            if (rows.some((item) => item.id === row.id)) {
              return rows;
            }
            return [...rows, row];
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void queryClient.invalidateQueries({ queryKey });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [elementId, pageId, queryClient, queryKey]);

  return query;
}

export function usePostComment(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      elementId,
      body,
    }: {
      pageId: string;
      elementId: string;
      body: PostElementCommentBody;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return apiFetch<ElementComment>(
        `/api/pages/${pageId}/elements/${elementId}/comments`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: (comment) => {
      const commentsKey = elementCommentsQueryKey(comment.page_id, comment.element_id);
      queryClient.setQueryData<ElementComment[]>(commentsKey, (previous) => {
        const rows = previous ?? [];
        if (rows.some((row) => row.id === comment.id)) {
          return rows;
        }
        return [...rows, comment];
      });

      queryClient.setQueryData<CommentCountRow[]>(
        pageCommentCountsQueryKey(comment.page_id),
        (previous) => {
          const rows = previous ?? [];
          const index = rows.findIndex(
            (row) => row.element_id === comment.element_id,
          );
          if (index < 0) {
            return [
              ...rows,
              {
                page_id: comment.page_id,
                element_id: comment.element_id,
                count: 1,
              },
            ];
          }
          const next = [...rows];
          next[index] = {
            ...next[index]!,
            count: next[index]!.count + 1,
          };
          return next;
        },
      );
    },
  });
}

export function usePageCommentCounts(pageId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: pageId
      ? pageCommentCountsQueryKey(pageId)
      : ["page-comment-counts", "none"],
    queryFn: () => fetchPageCommentCounts(pageId!),
    enabled: Boolean(pageId),
  });

  useEffect(() => {
    if (!pageId) {
      return;
    }

    const channel = supabase
      .channel(`element-comment-counts:${pageId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "element_comments",
          filter: `page_id=eq.${pageId}`,
        },
        (payload) => {
          const row = payload.new as ElementComment;
          queryClient.setQueryData<CommentCountRow[]>(
            pageCommentCountsQueryKey(pageId),
            (previous) => {
              const rows = previous ?? [];
              const index = rows.findIndex(
                (item) => item.element_id === row.element_id,
              );
              if (index < 0) {
                return [
                  ...rows,
                  {
                    page_id: row.page_id,
                    element_id: row.element_id,
                    count: 1,
                  },
                ];
              }
              const next = [...rows];
              next[index] = {
                ...next[index]!,
                count: next[index]!.count + 1,
              };
              return next;
            },
          );
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void queryClient.invalidateQueries({
            queryKey: pageCommentCountsQueryKey(pageId),
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pageId, queryClient]);

  const countByElementId = new Map(
    (query.data ?? []).map((row) => [row.element_id, row.count]),
  );

  return {
    ...query,
    countByElementId,
  };
}
