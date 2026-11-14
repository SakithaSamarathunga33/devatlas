import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";

import {
  DeleteAccountDialog,
  GithubSignIn,
  OwnerAvatar,
  useCommunitySession,
  useCommunitySignOut,
} from "@/features/community";
import { focusOnMount } from "@/lib/focus-on-mount";
import { describeError } from "@/services/ipc";

import { SettingsSection } from "./settings-section";

/** The GitHub account Community uses: who is signed in, or a way to sign in. */
export function AccountSettings() {
  const session = useCommunitySession();
  const signOut = useCommunitySignOut();
  // Signing in or out swaps the buttons; focus follows to the one that replaced the pressed one.
  const [hasSwitched, setHasSwitched] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const user = session.data ?? null;

  return (
    <SettingsSection
      title="Account"
      description="Signing in only connects Community. Your library, collections and snippets stay on this computer either way."
    >
      {session.isPending ? (
        <div role="status" aria-busy="true">
          <span className="sr-only">Checking your account</span>
          <Skeleton height={72} />
        </div>
      ) : user !== null ? (
        <VStack gap={3}>
          <HStack gap={3} vAlign="center">
            {/* The username beside it names the account, so the picture is decorative. */}
            <OwnerAvatar src={user.avatarUrl} className="size-10" />
            <VStack gap={0} className="min-w-0 flex-1">
              <Text weight="semibold" maxLines={1}>
                {user.username}
              </Text>
              <Text type="supporting">Signed in with GitHub, used for Community</Text>
            </VStack>
            <Button
              ref={hasSwitched ? focusOnMount : undefined}
              label="Sign out"
              isLoading={signOut.isPending}
              onClick={() => {
                signOut.mutate(undefined, {
                  onSuccess: () => {
                    setHasSwitched(true);
                  },
                });
              }}
            />
          </HStack>
          {signOut.isError && (
            <Banner
              role="alert"
              status="error"
              title="Couldn't sign out"
              description={describeError(signOut.error).replace(/^.*?failed: /, "")}
            />
          )}
          <HStack gap={3} vAlign="center">
            <div className="min-w-0 flex-1">
              <Text type="supporting" as="p">
                Deleting your Community account removes everything you shared there. Your library
                stays on this computer.
              </Text>
            </div>
            <Button
              variant="destructive"
              label="Delete Community account"
              onClick={() => {
                setIsConfirmingDelete(true);
              }}
            />
          </HStack>
        </VStack>
      ) : (
        <VStack gap={3}>
          <Text as="p" color="secondary">
            Not signed in. DevAtlas works fully offline; sign in to browse and share Community
            collections.
          </Text>
          <GithubSignIn
            isFocused={hasSwitched}
            onSignedIn={() => {
              setHasSwitched(true);
            }}
          />
        </VStack>
      )}
      {isConfirmingDelete && (
        <DeleteAccountDialog
          onClose={() => {
            setIsConfirmingDelete(false);
          }}
          onDeleted={() => {
            setIsConfirmingDelete(false);
            setHasSwitched(true);
          }}
        />
      )}
    </SettingsSection>
  );
}
