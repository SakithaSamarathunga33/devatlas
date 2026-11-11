import { z } from "zod";

import { invokeCommand } from "@/services/ipc";

/** The ids of the Explorer suggestions the user removed. */
export function listRemovedSuggestions(): Promise<string[]> {
  return invokeCommand("list_removed_suggestions", z.array(z.string()));
}

export function removeSuggestion(id: string): Promise<null> {
  return invokeCommand("remove_suggestion", z.null(), { id });
}

export function restoreSuggestions(ids: readonly string[]): Promise<null> {
  return invokeCommand("restore_suggestions", z.null(), { ids });
}
