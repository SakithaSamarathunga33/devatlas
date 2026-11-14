import { SideNavItem } from "@astryxdesign/core/SideNav";
import { useMutation } from "@tanstack/react-query";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { openExternal } from "@/features/discovery/repo-utils";
import { useUpdateCheck } from "@/hooks/use-app-info";
import { installUpdate } from "@/services/app-info.service";
import { describeError } from "@/services/ipc";

/** The backend's own explanation, without the IPC prefix. */
function errorText(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

/**
 * The sidebar's update item. With no update known it checks GitHub on request; once a newer
 * release is found, pressing it installs the signed update and restarts the app, and if that
 * fails the release page offers DevAtlas Setup.
 */
export function UpdateNavItem() {
  const update = useUpdateCheck();
  const install = useMutation({
    mutationFn: installUpdate,
    onError: (error) => {
      const releaseUrl = update.data?.url;
      toast.error("Couldn't update DevAtlas", {
        description: errorText(error),
        action: releaseUrl
          ? {
              label: "Open release page",
              onClick: () => {
                openExternal(releaseUrl, "the release page");
              },
            }
          : undefined,
      });
    },
  });
  if (!update.data) {
    return (
      <SideNavItem
        label={update.isFetching ? "Checking…" : "Check for updates"}
        icon={RefreshCw}
        isDisabled={update.isFetching}
        onClick={() => {
          void update.refetch().then((result) => {
            if (result.isError) {
              toast.error("Couldn't check for updates", { description: errorText(result.error) });
            } else if (!result.data) {
              toast.success("DevAtlas is up to date");
            }
          });
        }}
      />
    );
  }
  return (
    <SideNavItem
      label={install.isPending ? "Updating…" : `Update to ${update.data.tag}`}
      icon={Download}
      isDisabled={install.isPending}
      onClick={() => {
        install.mutate();
      }}
    />
  );
}
