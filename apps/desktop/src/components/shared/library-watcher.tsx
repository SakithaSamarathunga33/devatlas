import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { libraryQueryKey, useLibrary } from "@/hooks/use-library";
import { findArrivals } from "@/lib/library-arrivals";
import { syncGithubStars } from "@/services/agent.service";

/** How often synced GitHub stars are checked; each run is at most ten GitHub requests. */
const STAR_SYNC_EVERY_MS = 6 * 60 * 60 * 1000;

/**
 * Keeps the library fresh app-wide: syncs GitHub stars when that is on, and announces links
 * newly saved in the browser or added by the sync.
 */
export function LibraryWatcher() {
  const { data } = useLibrary();
  const queryClient = useQueryClient();
  // Off, the command returns 0 without calling GitHub. A failure waits for the next run.
  const starSync = useQuery({
    queryKey: ["star-sync-run"],
    queryFn: syncGithubStars,
    staleTime: STAR_SYNC_EVERY_MS,
    refetchInterval: STAR_SYNC_EVERY_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (starSync.data) void queryClient.invalidateQueries({ queryKey: libraryQueryKey });
  }, [starSync.data, starSync.dataUpdatedAt, queryClient]);
  const navigate = useNavigate();
  const announcedNewIds = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const arrivals = findArrivals(announcedNewIds.current, data.resources);
    announcedNewIds.current = new Set(
      data.resources.filter((resource) => resource.isNew).map((resource) => resource.id),
    );

    const [first] = arrivals;
    if (first === undefined) return;
    const openLibrary = {
      label: "View",
      onClick: () => {
        void navigate("/library");
      },
    };
    if (arrivals.length === 1) {
      toast.success("New in your library", { description: first.title, action: openLibrary });
    } else {
      toast.success(`${String(arrivals.length)} new resources in your library`, {
        description: arrivals.map((resource) => resource.title).join(", "),
        action: openLibrary,
      });
    }
  }, [data, navigate]);

  return null;
}
