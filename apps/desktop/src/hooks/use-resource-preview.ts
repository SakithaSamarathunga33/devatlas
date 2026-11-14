import { useQuery } from "@tanstack/react-query";

import { githubFullName } from "@/features/discovery/repo-utils";
import { getResourcePreview } from "@/services/library.service";
import type { ResourcePreview } from "@/types/preview.types";

/**
 * The owner's avatar for a GitHub repository's home page, as Repos shows it; GitHub's own
 * favicon is the same dark mark for every repository and barely shows on a dark tile.
 */
function githubOwnerAvatar(url: string): string | null {
  const owner = githubFullName(url)?.split("/")[0];
  return owner ? `https://github.com/${encodeURIComponent(owner)}.png?size=96` : null;
}

/** Preview images for a resource. The backend caches them on disk, so this never refetches. */
export function useResourcePreview(url: string) {
  return useQuery({
    queryKey: ["resource-preview", url],
    queryFn: () => getResourcePreview(url),
    select: (preview: ResourcePreview) => {
      const avatar = githubOwnerAvatar(url);
      return avatar ? { ...preview, icon: avatar } : preview;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
