import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { shareGroup, unshareCollection } from "@/services/community.service";
import type { SharePreview } from "@/types/community.types";

import { communityQueryKey, useCommunitySession, useSharePreview } from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { GithubSignIn } from "./community-account";

/** The server's limit. */
const MAX_LINKS = 200;

function PreviewBody({ preview }: { preview: SharePreview }) {
  const skipped = preview.skipped;
  return (
    <VStack gap={3}>
      <Banner
        status="warning"
        title="Anyone can see this"
        description="Everyone using DevAtlas Community can see the name, description and links below, and your GitHub username. Your notes, tags and reading status stay private."
      />
      <VStack gap={1}>
        <Heading level={4} accessibilityLevel={3}>
          {preview.title}
        </Heading>
        {preview.description !== null && (
          <Text type="supporting" as="p">
            {preview.description}
          </Text>
        )}
      </VStack>
      <ul aria-label="Links that will be shared" className="max-h-64 space-y-2 overflow-y-auto">
        {preview.links.map((link) => (
          <li key={link.url} className="min-w-0">
            <Text maxLines={1}>{link.title}</Text>
            <Text type="code" size="xsm" color="secondary" maxLines={1}>
              {link.host}
            </Text>
          </li>
        ))}
      </ul>
      {skipped > 0 && (
        <Text type="supporting" as="p">
          {skipped === 1
            ? "1 link isn't https and will be left out."
            : `${String(skipped)} links aren't https and will be left out.`}
        </Text>
      )}
      {preview.links.length === 0 && (
        <Banner status="error" title="This collection has no https links to share." />
      )}
      {preview.links.length > MAX_LINKS && (
        <Banner
          status="error"
          title={`A shared collection holds at most ${String(MAX_LINKS)} links; this one has ${String(preview.links.length)}.`}
        />
      )}
    </VStack>
  );
}

/** Previews exactly what goes public, then publishes, updates or unshares a local collection. */
export function ShareDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const session = useCommunitySession();
  const preview = useSharePreview(groupId);
  const sharedId = preview.data?.sharedId ?? null;
  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: communityQueryKey });
    toast.success(message);
    onClose();
  };
  const publish = useMutation({
    mutationFn: () => shareGroup(groupId),
    onSuccess: () => done(sharedId === null ? "Shared to Community" : "Community copy updated"),
  });
  const unshare = useMutation({
    mutationFn: () => (sharedId === null ? Promise.resolve(null) : unshareCollection(sharedId)),
    onSuccess: () => done("Removed from Community"),
  });
  const isSignedIn = session.data !== undefined && session.data !== null;
  const links = preview.data?.links.length ?? 0;
  const canPublish = isSignedIn && links > 0 && links <= MAX_LINKS;
  const failure = publish.error ?? unshare.error;

  return (
    <Modal title="Share to Community" onClose={onClose}>
      <VStack gap={4}>
        {preview.isPending && <Skeleton height={160} />}
        {preview.isError && (
          <Banner role="alert" status="error" title={errorMessage(preview.error)} />
        )}
        {preview.isSuccess && <PreviewBody preview={preview.data} />}
        {!session.isPending && !isSignedIn && (
          <VStack gap={2}>
            <Text type="supporting" as="p">
              Sign in with GitHub to share. Your GitHub username is shown as the owner.
            </Text>
            <GithubSignIn />
          </VStack>
        )}
        {failure !== null && <Banner role="alert" status="error" title={errorMessage(failure)} />}
        <HStack gap={2} hAlign="end">
          {sharedId !== null && isSignedIn && (
            <Button
              variant="ghost"
              label="Unshare"
              isLoading={unshare.isPending}
              onClick={() => {
                publish.reset();
                unshare.mutate();
              }}
            />
          )}
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="primary"
            label={sharedId === null ? "Publish" : "Update"}
            isLoading={publish.isPending}
            isDisabled={!canPublish}
            onClick={() => {
              unshare.reset();
              publish.mutate();
            }}
          />
        </HStack>
      </VStack>
    </Modal>
  );
}
