import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Users } from "lucide-react";
import type { ReactNode } from "react";

import { useCommunitySession } from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { GithubSignIn } from "./community-account";

/** Community needs an account: signed out, its pages show only the way to sign in. */
export function CommunitySignInGate({ children }: { children: ReactNode }) {
  const session = useCommunitySession();

  if (session.isPending) {
    return (
      <div role="status" aria-busy="true">
        <span className="sr-only">Checking your Community account</span>
      </div>
    );
  }
  if (session.data !== undefined && session.data !== null) return children;
  // A failed refetch keeps the last answer ("signed out"); only an unanswered check is reported.
  const failure =
    session.isError && session.data === undefined ? errorMessage(session.error) : null;
  return <SignInPanel failure={failure} />;
}

function SignInPanel({ failure }: { failure: string | null }) {
  return (
    <div className="relative isolate grid min-h-full place-items-center p-6">
      <div aria-hidden className="glass-glow" />
      <section aria-labelledby="community-sign-in" className="glass-panel w-full max-w-md p-8">
        <VStack gap={5} hAlign="center">
          <span className="glass-chip size-14">
            <Icon icon={Users} size="lg" color="accent" />
          </span>
          <VStack gap={2} hAlign="center">
            <Heading level={1} id="community-sign-in" justify="center">
              Sign in to browse Community
            </Heading>
            <Text as="p" color="secondary" justify="center">
              Browse collections other developers shared and copy their links into your library.
              Your own library stays on this computer.
            </Text>
          </VStack>
          {failure !== null && (
            <Banner
              role="alert"
              status="error"
              title="Your account couldn't be checked"
              description={failure}
            />
          )}
          <GithubSignIn isFullWidth />
        </VStack>
      </section>
    </div>
  );
}
