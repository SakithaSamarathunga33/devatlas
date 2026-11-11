import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { StackItem } from "@astryxdesign/core/Stack";
import { Toolbar } from "@astryxdesign/core/Toolbar";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Lock, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { describeError } from "@/services/ipc";
import { openInBrowser } from "@/services/library.service";
import {
  boundsOf,
  closeViewer,
  onViewerPageLoad,
  openViewer,
  setViewerBounds,
  viewerGo,
  type ViewerAction,
  type ViewerPageLoad,
} from "@/services/viewer.service";

interface SiteViewerProps {
  url: string;
  /** Shown while loading and in errors, e.g. "uilora.com". */
  host: string;
  backTo: string;
  backLabel: string;
}

/** A website shown inside DevAtlas, with browser controls. Remote pages get no IPC access. */
export function SiteViewer({ url, host, backTo, backLabel }: SiteViewerProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<ViewerPageLoad>({ url, loading: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    let active = true;

    openViewer(url, boundsOf(frame)).catch((cause: unknown) => {
      if (active) setError(describeError(cause));
    });

    const syncBounds = () => {
      setViewerBounds(boundsOf(frame)).catch((cause: unknown) => {
        console.warn("Could not resize the site viewer.", cause);
      });
    };
    const observer = new ResizeObserver(syncBounds);
    observer.observe(frame);
    window.addEventListener("resize", syncBounds);

    const unlisten = onViewerPageLoad((event) => {
      if (active) setPage(event);
    });

    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
      void unlisten.then((stop) => {
        stop();
      });
      closeViewer().catch((cause: unknown) => {
        console.warn("Could not close the site viewer.", cause);
      });
    };
  }, [url]);

  const go = (action: ViewerAction) => {
    viewerGo(action).catch((cause: unknown) => {
      toast.error(describeError(cause));
    });
  };

  const openExternally = () => {
    openInBrowser(page.url).catch((cause: unknown) => {
      toast.error(`Couldn't open ${host}`, { description: describeError(cause) });
    });
  };

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        label="Site viewer"
        dividers={["bottom"]}
        className="shrink-0"
        startContent={
          <>
            <IconButton
              label={backLabel}
              variant="ghost"
              icon={<Icon icon={ArrowLeft} />}
              href={backTo}
            />
            <Divider orientation="vertical" />
            <IconButton
              label="Go back"
              variant="ghost"
              icon={<Icon icon={ChevronLeft} />}
              onClick={() => {
                go("back");
              }}
            />
            <IconButton
              label="Go forward"
              variant="ghost"
              icon={<Icon icon={ChevronRight} />}
              onClick={() => {
                go("forward");
              }}
            />
            {/* Not isLoading: a stuck page must stay reloadable. */}
            <IconButton
              label="Reload"
              variant="ghost"
              icon={page.loading ? <Spinner size="sm" aria-hidden /> : <Icon icon={RotateCw} />}
              onClick={() => {
                go("reload");
              }}
            />
          </>
        }
        centerContent={
          // A fixed share of the window: the lane sizes to its content, so a long URL must truncate.
          <div className="w-[min(42rem,50vw)]">
            <Card variant="muted" padding={1.5}>
              <HStack gap={1.5} vAlign="center">
                {page.url.startsWith("https://") && (
                  <Icon icon={Lock} size="xsm" color="success" label="Secure connection" />
                )}
                <StackItem size="fill">
                  <Text type="code" color="secondary" maxLines={1}>
                    {page.url}
                  </Text>
                </StackItem>
              </HStack>
            </Card>
          </div>
        }
        endContent={
          <Button
            label="Open in browser"
            variant="ghost"
            icon={<Icon icon={ExternalLink} />}
            onClick={openExternally}
          />
        }
      />

      {/* The native site view is placed exactly over this element by the Rust backend. */}
      <div ref={frameRef} className="relative min-h-0 flex-1">
        {error === null ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="xl" label={`Loading ${host}`} />
          </div>
        ) : (
          <div className="mx-auto max-w-md pt-24">
            <Banner
              status="error"
              role="alert"
              title={`Couldn't show ${host} here`}
              description={error}
              endContent={
                <Button
                  label="Open in browser instead"
                  icon={<Icon icon={ExternalLink} />}
                  onClick={openExternally}
                />
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
