import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";

import { GithubMark } from "@/features/discovery";
import { focusOnMount } from "@/lib/focus-on-mount";
import { cn } from "@/lib/utils";

import { useCommunitySignIn } from "../hooks/use-community";
import { errorMessage } from "../error-message";

/** A GitHub avatar. A plain image because Astryx's Avatar can't set `referrerPolicy`. */
export function OwnerAvatar({ src, className }: { src: string | null; className?: string }) {
  return src === null ? (
    <span
      aria-hidden
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: "var(--color-background-muted)" }}
    />
  ) : (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ backgroundColor: "var(--color-background-muted)" }}
    />
  );
}

interface GithubSignInProps {
  label?: string;
  /** Moves focus to the button when it appears, for screens where it is the main action. */
  isFocused?: boolean;
  /** Stretches the buttons to the container, for narrow centered panels. */
  isFullWidth?: boolean;
  onSignedIn?: () => void;
}

/** Sign in with GitHub, then wait for the browser (with Cancel), explaining failures. */
export function GithubSignIn({
  label = "Sign in with GitHub",
  isFocused = false,
  isFullWidth = false,
  onSignedIn,
}: GithubSignInProps) {
  const { signIn, cancel } = useCommunitySignIn();
  // After a cancelled or failed attempt the button comes back; focus returns to it.
  const [hasTried, setHasTried] = useState(false);
  const width = isFullWidth ? "100%" : undefined;

  if (signIn.isPending) {
    return (
      <VStack gap={2} width={width} maxWidth={isFullWidth ? undefined : 360}>
        <HStack gap={2} vAlign="center">
          <div className={cn(isFullWidth && "min-w-0 flex-1")}>
            <Button
              label="Waiting for GitHub"
              isLoading
              width={width}
              icon={<GithubMark className="size-4" />}
            />
          </div>
          {/* The button pressed is gone; Cancel is what can be done now. */}
          <Button ref={focusOnMount} variant="ghost" label="Cancel" onClick={cancel} />
        </HStack>
        <Text type="supporting" as="p">
          Finish signing in in your browser. If it shows an error such as “Unsupported provider”,
          GitHub sign-in isn&apos;t enabled for Community yet: cancel and try again later.
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap={2} width={width} maxWidth={isFullWidth ? undefined : 360}>
      <Button
        ref={isFocused || hasTried ? focusOnMount : undefined}
        variant="primary"
        label={label}
        width={width}
        icon={<GithubMark className="size-4" />}
        onClick={() => {
          setHasTried(true);
          signIn.mutate(undefined, { onSuccess: onSignedIn });
        }}
      />
      {signIn.isError && <Banner role="alert" status="error" title={errorMessage(signIn.error)} />}
    </VStack>
  );
}
