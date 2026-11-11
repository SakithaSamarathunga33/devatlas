import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Center } from "@astryxdesign/core/Center";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Icon } from "@astryxdesign/core/Icon";
import { Spinner } from "@astryxdesign/core/Spinner";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router";

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
    return (
      <Center className="mt-24">
        <Spinner size="xl" label="Opening" />
      </Center>
    );
  }
  if (resource === undefined) {
    const back = (
      <Button href="/library" label="Back to library" icon={<Icon icon={ArrowLeft} />} />
    );
    return (
      <div className="mx-auto max-w-xl px-6 pt-16">
        {library.isError ? (
          <Banner
            role="alert"
            status="error"
            title="Library unavailable"
            description={library.error.message}
            endContent={back}
          />
        ) : (
          <EmptyState
            title="This resource is no longer in your library."
            headingLevel={1}
            actions={back}
          />
        )}
      </div>
    );
  }
  return <ResourceViewer key={resource.id} resource={resource} />;
}

function ResourceViewer({ resource }: { resource: Resource }) {
  const queryClient = useQueryClient();

  // Records every open, once per visit; a new resource's "new" mark clears with it.
  useEffect(() => {
    markResourceOpened(resource.id)
      .then(() => queryClient.invalidateQueries({ queryKey: libraryQueryKey }))
      .catch((cause: unknown) => {
        console.warn("Could not mark the resource as opened.", cause);
      });
  }, [resource.id, queryClient]);

  return (
    <SiteViewer
      url={resource.url}
      host={resource.host}
      backTo="/library"
      backLabel="Back to library"
    />
  );
}
