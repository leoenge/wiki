export const pagesQueryKey = ["pages"] as const;

export function pageByTagQueryKey(tag: string) {
  return ["page", "tag", tag] as const;
}

export function pageElementsQueryKey(pageId: string) {
  return ["page-elements", pageId] as const;
}
