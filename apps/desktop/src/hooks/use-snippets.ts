import { useQuery } from "@tanstack/react-query";

import { listSnippets } from "@/services/snippets.service";

export const snippetsQueryKey = ["snippets"] as const;

export function useSnippets() {
  return useQuery({ queryKey: snippetsQueryKey, queryFn: listSnippets, retry: false });
}
