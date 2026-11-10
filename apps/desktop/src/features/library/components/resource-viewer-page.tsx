import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Lock,
  RotateCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";

import Loader from "@/components/kokonutui/loader";
import { Button } from "@/components/ui/button";
import { libraryQueryKey, useLibrary } from "@/hooks/use-library";
import { cn } from "@/lib/utils";
import { describeError } from "@/services/ipc";
import { markResourceOpened, openInBrowser } from "@/services/library.service";
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
import type { Resource } from "@/types/library.types";

/** Shows a library resource's site inside DevAtlas. */
export function ResourceViewerPage() {
  const { resourceId = "" } = useParams();
  const library = useLibrary();
  const resource = library.data?.resources.find(
    (candidate) => candidate.id === resourceId || encodeURIComponent(candidate.id) === resourceId,
  );

  if (library.isPending) {
    return <Loader size="md" title="Opening" subtitle="" className="mt-24" />;
  }
  if (resource === undefined) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-16 text-sm text-muted-foreground">
        <p>
          {library.isError
            ? library.error.message
            : "This resource is no longer in your Brave develop folder."}
        </p>
        <Link to="/library" className="mt-4 inline-flex items-center gap-1.5 text-primary">
          <ArrowLeft className="size-4" aria-hidden />
          Back to library
        </Link>
      </div>
    );
  }
  return <ResourceViewer key={resource.id} resource={resource} />;
}

function ResourceViewer({ resource }: { resource: Resource }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Opening a new resource clears its "new" mark.
  useEffect(() => {
    if (!resource.isNew) return;
    markResourceOpened(resource.id)
      .then(() => queryClient.invalidateQueries({ queryKey: libraryQueryKey }))
      .catch((cause: unknown) => {
        console.warn("Could not mark the resource as opened.", cause);
      });
  }, [resource.id, resource.isNew, queryClient]);
  const [page, setPage] = useState<ViewerPageLoad>({ url: resource.url, loading: true });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    let active = true;

    openViewer(resource.url, boundsOf(frame)).catch((cause: unknown) => {
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
  }, [resource.url]);

  const go = (action: ViewerAction) => {
    viewerGo(action).catch((cause: unknown) => {
      toast.error(describeError(cause));
    });
  };

  const openExternally = () => {
    openInBrowser(page.url).catch((cause: unknown) => {
      toast.error(`Couldn't open ${resource.host}`, { description: describeError(cause) });
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-white/[0.06] bg-background/70 px-3 backdrop-blur-xl">
        <Button variant="ghost" size="icon-sm" asChild className="text-muted-foreground">
          <Link to="/library" aria-label="Back to library">
            <ArrowLeft />
          </Link>
        </Button>
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Go back"
          onClick={() => {
            go("back");
          }}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Go forward"
          onClick={() => {
            go("forward");
          }}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reload"
          onClick={() => {
            go("reload");
          }}
        >
          <RotateCw className={cn(page.loading && "animate-spin motion-reduce:animate-none")} />
        </Button>

        <div className="mx-2 flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 text-xs">
          {page.url.startsWith("https://") && (
            <Lock className="size-3.5 shrink-0 text-success" aria-label="Secure connection" />
          )}
          <span className="truncate font-mono text-muted-foreground" title={page.url}>
            {page.url}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={openExternally}
          className="text-muted-foreground"
        >
          <ExternalLink />
          Open in browser
        </Button>
      </div>

      {/* The native site view is placed exactly over this element by the Rust backend. */}
      <div ref={frameRef} className="relative min-h-0 flex-1">
        {error === null ? (
          <Loader
            size="md"
            title={`Loading ${resource.host}`}
            subtitle=""
            className="absolute inset-0"
          />
        ) : (
          <div role="alert" className="flex flex-col items-center gap-3 pt-24 text-sm">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <CircleAlert className="size-4" aria-hidden />
              Couldn't show {resource.host} here
            </p>
            <p className="max-w-md text-center text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={openExternally}>
              <ExternalLink />
              Open in browser instead
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
