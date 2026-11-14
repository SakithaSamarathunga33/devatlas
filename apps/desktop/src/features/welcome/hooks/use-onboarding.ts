import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { completeOnboarding, getOnboarded } from "@/services/settings.service";

const onboardedQueryKey = ["onboarded"] as const;

/** Whether the first-launch welcome was answered. Read once; only this app changes it. */
export function useOnboarded() {
  return useQuery({
    queryKey: onboardedQueryKey,
    queryFn: getOnboarded,
    staleTime: Infinity,
    retry: false,
  });
}

/** Answers the welcome. It closes even if saving fails, so nobody is stuck on it. */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeOnboarding,
    onError: () => {
      toast.error("Your choice couldn't be saved", {
        description: "The welcome will show again the next time DevAtlas opens.",
      });
    },
    onSettled: () => {
      queryClient.setQueryData(onboardedQueryKey, true);
    },
  });
}
