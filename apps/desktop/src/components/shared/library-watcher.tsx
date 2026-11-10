import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useLibrary } from "@/hooks/use-library";
import { findArrivals } from "@/lib/library-arrivals";

/** Keeps the library fresh app-wide and announces links newly saved in Brave. */
export function LibraryWatcher() {
  const { data } = useLibrary();
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
