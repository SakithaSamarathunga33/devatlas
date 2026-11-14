import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

import { WindowControls } from "@/components/layout/app-header";
import { GithubSignIn } from "@/features/community";

import { useCompleteOnboarding } from "../hooks/use-onboarding";

/** The first launch: sign in for Community, or use DevAtlas without an account. Shown once. */
export function WelcomeScreen() {
  const complete = useCompleteOnboarding();
  const finish = () => {
    complete.mutate();
  };

  return (
    <div className="aurora-backdrop relative isolate flex h-screen flex-col overflow-hidden">
      <div aria-hidden className="glass-glow" />
      {/* The window is undecorated: this strip moves it and holds its controls. */}
      <div data-tauri-drag-region className="flex h-12 shrink-0 items-center justify-end px-2">
        <WindowControls />
      </div>
      <main className="grid flex-1 place-items-center overflow-y-auto p-6 pb-18">
        <section
          aria-labelledby="welcome-title"
          className="glass-panel w-full max-w-[28rem] px-8 py-10 motion-safe:animate-in motion-safe:duration-500 motion-safe:fade-in-0 motion-safe:zoom-in-95"
        >
          <VStack gap={8} hAlign="center">
            <VStack gap={4} hAlign="center">
              <img
                src="/devatlas-mark.png"
                alt=""
                width={64}
                height={64}
                className="outline-none"
              />
              <VStack gap={2} hAlign="center">
                <Heading level={1} id="welcome-title" type="display-3" justify="center">
                  Welcome to DevAtlas
                </Heading>
                <Text as="p" color="secondary" justify="center">
                  Capture, organize and rediscover the developer resources you find, kept on this
                  computer.
                </Text>
              </VStack>
            </VStack>

            <VStack gap={3} width="100%">
              <GithubSignIn
                label="Continue with GitHub"
                isFocused
                isFullWidth
                onSignedIn={finish}
              />
              <Button
                label="Use DevAtlas locally"
                width="100%"
                isLoading={complete.isPending}
                onClick={finish}
              />
            </VStack>

            <Text as="p" type="supporting" justify="center">
              An account is only needed for Community, where developers share collections.
              Everything else works without one, and you can sign in later.
            </Text>
          </VStack>
        </section>
      </main>
    </div>
  );
}
