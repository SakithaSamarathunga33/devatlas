import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router";

import Loader from "@/components/kokonutui/loader";
import { SiteViewer } from "@/components/shared/site-viewer";
import { libraryQueryKey, useLibrary } from "@/hooks/use-library";
import { markResourceOpened } from "@/services/library.service";
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
          {library.isError ? library.error.message : "This resource is no longer in your library."}
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

  return (
    <SiteViewer
      url={resource.url}
      host={resource.host}
      backTo="/library"
      backLabel="Back to library"
    />
  );
}
