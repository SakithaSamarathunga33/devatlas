import { Theme } from "@astryxdesign/core/theme";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState, type PropsWithChildren } from "react";
import { Toaster } from "sonner";

import { defaultThemeSlug, themes } from "@/astryx-themes";
import { createQueryClient } from "@/lib/query-client";
import { useUiStore } from "@/stores/ui-store";

/** Single place where app-wide providers are composed. */
export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);
  const mode = useUiStore((state) => state.theme);

  return (
    <Theme theme={themes[defaultThemeSlug]} mode={mode}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          {children}
          <Toaster theme={mode} position="bottom-right" />
        </MotionConfig>
      </QueryClientProvider>
    </Theme>
  );
}
