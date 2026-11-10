import { QueryClient } from "@tanstack/react-query";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Desktop windows gain and lose focus constantly; refetching on focus is noise here.
        refetchOnWindowFocus: false,
        staleTime: 30_000,
      },
    },
  });
}
