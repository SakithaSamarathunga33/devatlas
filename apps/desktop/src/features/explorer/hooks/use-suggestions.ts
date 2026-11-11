import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { describeError } from "@/services/ipc";
import {
  listRemovedSuggestions,
  removeSuggestion,
  restoreSuggestions,
} from "@/services/suggestions.service";

import { suggestionId, type SuggestedLink } from "../suggested-links";

const removedSuggestionsQueryKey = ["removed-suggestions"] as const;

export function useRemovedSuggestions() {
  return useQuery({
    queryKey: removedSuggestionsQueryKey,
    queryFn: listRemovedSuggestions,
    retry: false,
  });
}

/** Remove (with undo) and restore for Explorer's suggested links. */
export function useSuggestionActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: removedSuggestionsQueryKey });

  const restore = (ids: readonly string[]) => {
    restoreSuggestions(ids)
      .then(refresh)
      .catch((error: unknown) => {
        toast.error("Couldn't restore the links", { description: describeError(error) });
      });
  };

  const remove = (link: SuggestedLink) => {
    const id = suggestionId(link.url);
    removeSuggestion(id)
      .then(async () => {
        await refresh();
        toast(`Removed “${link.title}”`, {
          action: {
            label: "Undo",
            onClick: () => {
              restore([id]);
            },
          },
        });
      })
      .catch((error: unknown) => {
        toast.error("Couldn't remove the link", { description: describeError(error) });
      });
  };

  return { remove, restore };
}
