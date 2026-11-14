import { SideNavItem } from "@astryxdesign/core/SideNav";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { openExternal } from "@/features/discovery/repo-utils";
import { useUpdateCheck } from "@/hooks/use-app-info";
import { installUpdate } from "@/services/app-info.service";
import { describeError } from "@/services/ipc";

/**
 * A sidebar item shown only when GitHub has a newer DevAtlas release. Pressing it installs the
 * signed update and restarts the app; if that fails, the release page offers DevAtlas Setup.
 */
export function UpdateNavItem() {
  const update = useUpdateCheck();
  const install = useMutation({
    mutationFn: installUpdate,
    onError: (error) => {
      const releaseUrl = update.data?.url;
      toast.error("Couldn't update DevAtlas", {
        // The backend's own explanation, without the IPC prefix.
        description: describeError(error).replace(/^.*?failed: /, ""),
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
  if (!update.data) return null;
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
