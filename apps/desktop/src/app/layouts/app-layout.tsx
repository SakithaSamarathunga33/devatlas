import { AppShell } from "@astryxdesign/core/AppShell";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import type { ComponentProps } from "react";
import { Link, Outlet } from "react-router";
import { toast } from "sonner";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BackendStatus } from "@/components/shared/backend-status";
import { LibraryWatcher } from "@/components/shared/library-watcher";
import { openExternal } from "@/features/discovery/repo-utils";
import { useAppInfo, useUpdateCheck } from "@/hooks/use-app-info";
import { useLibrary } from "@/hooks/use-library";
import { installUpdate } from "@/services/app-info.service";
import { describeError } from "@/services/ipc";
import { formatPlatform } from "@/lib/platform";

/** Astryx links route in-app, so the window never reloads. */
function RouterLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "to"> & { href: string }) {
  return <Link to={href} {...props} />;
}

export function AppLayout() {
  return (
    <LinkProvider component={RouterLink}>
      <LibraryWatcher />
      <AppShell
        height="fill"
        variant="elevated"
        mobileNav={false}
        topNav={<AppHeader />}
        sideNav={<AppSidebar />}
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {/* `relative` keeps absolutely positioned descendants inside this scroll container. */}
          <div className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <Outlet />
          </div>
          <StatusBar />
        </div>
      </AppShell>
    </LinkProvider>
  );
}

function StatusBar() {
  const appInfo = useAppInfo();
  const library = useLibrary();
  return (
    <div className="flex h-9 shrink-0 items-center gap-4 border-t border-[var(--color-border)] px-4">
      <BackendStatus />
      {library.isSuccess && (
        <Text type="supporting">{library.data.resources.length} resources</Text>
      )}
      <span className="ml-auto">
        <UpdateNotice />
      </span>
      <span>
        <Text type="supporting">
          {appInfo.isSuccess
            ? `DevAtlas ${appInfo.data.version} · ${formatPlatform(appInfo.data.platform)}`
            : "DevAtlas"}
        </Text>
      </span>
    </div>
  );
}

/**
 * Shown only when GitHub has a newer DevAtlas release. Pressing it installs the signed update
 * and restarts the app; if that fails, the release page offers DevAtlas Setup instead.
 */
function UpdateNotice() {
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
    <Button
      label={`Update to ${update.data.tag}`}
      variant="ghost"
      size="sm"
      icon={<Icon icon={Download} />}
      isLoading={install.isPending}
      onClick={() => {
        install.mutate();
      }}
    />
  );
}
