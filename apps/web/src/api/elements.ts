import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  CreateElementBody,
  PageElement,
  ReorderElementsBody,
  UpdateElementBody,
} from "@ww/types";

import { apiFetch } from "./client.js";
import { pageElementsQueryKey } from "./queries.js";

export function createElement(
  accessToken: string,
  pageId: string,
  body: CreateElementBody,
): Promise<PageElement> {
  return apiFetch<PageElement>(`/api/pages/${pageId}/elements`, accessToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateElement(
  accessToken: string,
  pageId: string,
  elementId: string,
  body: UpdateElementBody,
): Promise<PageElement> {
  return apiFetch<PageElement>(
    `/api/pages/${pageId}/elements/${elementId}`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );
}

export function reorderElements(
  accessToken: string,
  pageId: string,
  body: ReorderElementsBody,
): Promise<PageElement[]> {
  return apiFetch<PageElement[]>(
    `/api/pages/${pageId}/elements/reorder`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

export function useCreateElement(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      body,
    }: {
      pageId: string;
      body: CreateElementBody;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return createElement(accessToken, pageId, body);
    },
    onSuccess: (element) => {
      void queryClient.invalidateQueries({
        queryKey: pageElementsQueryKey(element.page_id),
      });
    },
  });
}

export function useUpdateElement(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      elementId,
      body,
    }: {
      pageId: string;
      elementId: string;
      body: UpdateElementBody;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return updateElement(accessToken, pageId, elementId, body);
    },
    onSuccess: (element) => {
      void queryClient.invalidateQueries({
        queryKey: pageElementsQueryKey(element.page_id),
      });
    },
  });
}

export function useReorderElements(accessToken: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      body,
    }: {
      pageId: string;
      body: ReorderElementsBody;
    }) => {
      if (!accessToken) {
        throw new Error("Not signed in");
      }
      return reorderElements(accessToken, pageId, body);
    },
    onMutate: async ({ pageId, body }) => {
      const queryKey = pageElementsQueryKey(pageId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<PageElement[]>(queryKey);
      if (previous) {
        const byId = new Map(previous.map((element) => [element.id, element]));
        queryClient.setQueryData(
          queryKey,
          body.element_ids.map((id, index) => ({
            ...byId.get(id)!,
            position: index,
          })),
        );
      }

      return { previous, pageId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          pageElementsQueryKey(context.pageId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({
        queryKey: pageElementsQueryKey(variables.pageId),
      });
    },
  });
}
