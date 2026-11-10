import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { libraryQueryKey } from "@/hooks/use-library";
import { describeError } from "@/services/ipc";
import { addLink, openInBrowser, removeLink } from "@/services/library.service";
import type { Resource } from "@/types/library.types";

/** Path of the in-app viewer for a resource. */
export function viewerPath(resource: Resource): string {
  return `/library/${encodeURIComponent(resource.id)}`;
}

/** Remove (with undo) and open-in-browser actions shared by the card and list views. */
export function useResourceActions(resource: Resource) {
  const queryClient = useQueryClient();
  const refreshLibrary = () => queryClient.invalidateQueries({ queryKey: libraryQueryKey });

  const openExternally = () => {
    openInBrowser(resource.url).catch((error: unknown) => {
      toast.error(`Couldn't open ${resource.host}`, { description: describeError(error) });
    });
  };

  const remove = () => {
    removeLink(resource.id)
      .then(async () => {
        await refreshLibrary();
        toast(`Removed “${resource.title}”`, {
          action: {
            label: "Undo",
            onClick: () => {
              addLink(resource.url)
                .then(refreshLibrary)
                .catch((error: unknown) => {
                  toast.error("Couldn't restore the link", { description: describeError(error) });
                });
            },
          },
        });
      })
      .catch((error: unknown) => {
        toast.error("Couldn't remove the link", { description: describeError(error) });
      });
  };

  return { openExternally, remove };
}
