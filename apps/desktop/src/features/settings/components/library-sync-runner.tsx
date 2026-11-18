import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import {
  refreshAfterSync,
  syncRunQueryKey,
  syncStatusQueryKey,
  useLibrarySyncRun,
  useLibrarySyncStatus,
} from "../hooks/use-library-sync";

/** Changes are sent this long after the last one, so a burst of edits is one sync. */
const AFTER_CHANGE_MS = 15 * 1000;

/**
 * Keeps the library in sync app-wide while sync is on: at startup, every few minutes, and
 * shortly after any change. Failures wait for the next run; Settings shows them.
 */
export function LibrarySyncRunner() {
  const queryClient = useQueryClient();
  const status = useLibrarySyncStatus();
  const isOn = status.data?.state === "on";
  const run = useLibrarySyncRun(isOn);

  useEffect(() => {
    if (!isOn) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Every change in DevAtlas goes through a mutation.
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A sync already running covers this change too.
        void queryClient.refetchQueries({ queryKey: syncRunQueryKey }, { cancelRefetch: false });
      }, AFTER_CHANGE_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [isOn, queryClient]);

  useEffect(() => {
    if (run.data === undefined) return;
    if (run.data.changed) refreshAfterSync(queryClient);
    void queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
  }, [run.data, run.dataUpdatedAt, queryClient]);

  useEffect(() => {
    // Sync may have stopped (a new passphrase elsewhere); the status says what to do.
    if (run.errorUpdatedAt > 0)
      void queryClient.invalidateQueries({ queryKey: syncStatusQueryKey });
  }, [run.errorUpdatedAt, queryClient]);

  return null;
}
