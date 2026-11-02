import { useQuery } from "@tanstack/react-query";

import { getSignedImageUrl } from "./images.js";

export function imageUrlQueryKey(path: string) {
  return ["image-url", path] as const;
}

export function useImageUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: path ? imageUrlQueryKey(path) : ["image-url", "none"],
    queryFn: () => getSignedImageUrl(path!),
    enabled: Boolean(path),
    staleTime: 50 * 60 * 1000,
  });
}
