import { useQuery } from "@tanstack/react-query";

import { getResourcePreview } from "@/services/library.service";

/** Preview images for a resource. The backend caches them on disk, so this never refetches. */
export function useResourcePreview(url: string) {
  return useQuery({
    queryKey: ["resource-preview", url],
    queryFn: () => getResourcePreview(url),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
