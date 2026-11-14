import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Flag, ListPlus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { SaveRepoButton } from "@/features/discovery";
import { SiteIcon } from "@/features/library";
import { WebLink } from "@/features/news";
import { libraryQueryKey, useLibrary } from "@/hooks/use-library";
import { addLink } from "@/services/library.service";
import type { SharedCollection, SharedLink } from "@/types/community.types";

import { useCommunitySession, useSharedCollection } from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { OwnerAvatar } from "./community-account";
import { ReportDialog, UnshareDialog } from "./collection-dialogs";
import { CommunitySignInGate } from "./community-sign-in-gate";
import { FollowButton, FollowerCount } from "./follow-button";

/** No preview fetch: requesting another user's links would tell them who opened the collection
 * and when, so each row shows the host's initial instead. */
function SharedLinkRow({ link, isSaved }: { link: SharedLink; isSaved: boolean }) {
  return (
    <ListItem
      startContent={<SiteIcon icon={null} host={link.host} className="size-9 rounded-lg text-sm" />}
      label={
        <Text weight="medium" maxLines={1}>
          <WebLink href={link.url}>{link.title}</WebLink>
        </Text>
      }
      description={
        <Text type="code" size="xsm" color="secondary" maxLines={1}>
          {link.host}
        </Text>
      }
      endContent={
        <SaveRepoButton repo={{ fullName: link.title, url: link.url }} saved={isSaved} compact />
      }
    />
  );
}

/** Saves every link that isn't in the library yet, one after another. */
function AddAllButton({ links }: { links: readonly SharedLink[] }) {
  const queryClient = useQueryClient();
  const addAll = useMutation({
    mutationFn: async () => {
      let added = 0;
      let failed = 0;
      for (const link of links) {
        try {
          await addLink(link.url);
          added += 1;
        } catch {
          failed += 1;
        }
      }
      return { added, failed };
    },
    onSuccess: async ({ added, failed }) => {
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      const summary = `Added ${String(added)} ${added === 1 ? "link" : "links"} to your library`;
      if (failed === 0) toast.success(summary);
      else toast.warning(summary, { description: `${String(failed)} couldn't be added.` });
    },
  });
  return (
    <Button
      variant="primary"
      label={links.length === 0 ? "All in your library" : "Add all to library"}
      icon={<Icon icon={ListPlus} />}
      isDisabled={links.length === 0}
      isLoading={addAll.isPending}
      onClick={() => {
        addAll.mutate();
      }}
    />
  );
}

function CollectionView({ collection }: { collection: SharedCollection }) {
  const session = useCommunitySession();
  const library = useLibrary();
  const [dialog, setDialog] = useState<"report" | "unshare" | null>(null);
  const savedIds = new Set(library.data?.resources.map((resource) => resource.id.toLowerCase()));
  const isSaved = (link: SharedLink) => savedIds.has(link.libraryId.toLowerCase());
  const unsaved = collection.links.filter((link) => !isSaved(link));
  const user = session.data ?? null;
  const isOwner = user !== null && user.id === collection.owner.id;
  const close = () => {
    setDialog(null);
  };

  return (
    <VStack gap={4}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <VStack gap={2} className="min-w-0">
          <Heading level={1}>{collection.title}</Heading>
          <HStack gap={2} vAlign="center">
            <OwnerAvatar src={collection.owner.avatarUrl} className="size-6" />
            <Text type="supporting">
              Shared by {collection.owner.username} · {collection.links.length}{" "}
              {collection.links.length === 1 ? "link" : "links"} · updated{" "}
              <Timestamp value={collection.updatedAt} format="relative" hasTooltip={false} />
            </Text>
          </HStack>
          {collection.description !== null && (
            <Text as="p" color="secondary">
              {collection.description}
            </Text>
          )}
        </VStack>
        <HStack gap={2} vAlign="center">
          {isOwner ? (
            <FollowerCount count={collection.followerCount} />
          ) : (
            <FollowButton collection={collection} />
          )}
          {library.isSuccess && <AddAllButton links={unsaved} />}
          {isOwner && (
            <Button
              variant="ghost"
              label="Unshare"
              icon={<Icon icon={Trash2} />}
              onClick={() => {
                setDialog("unshare");
              }}
            />
          )}
          {user !== null && !isOwner && (
            <Button
              variant="ghost"
              label="Report"
              icon={<Icon icon={Flag} />}
              onClick={() => {
                setDialog("report");
              }}
            />
          )}
        </HStack>
      </div>

      {collection.links.length === 0 ? (
        <EmptyState headingLevel={2} title="This collection has no links." />
      ) : (
        <List hasDividers>
          {collection.links.map((link) => (
            <SharedLinkRow key={link.url} link={link} isSaved={isSaved(link)} />
          ))}
        </List>
      )}

      {dialog === "report" && <ReportDialog collection={collection} onClose={close} />}
      {dialog === "unshare" && <UnshareDialog collectionId={collection.id} onClose={close} />}
    </VStack>
  );
}

/** One published collection: its links, each addable to the library. Signed in only. */
export function SharedCollectionPage() {
  return (
    <CommunitySignInGate>
      <SharedCollection />
    </CommunitySignInGate>
  );
}

function SharedCollection() {
  const { collectionId = "" } = useParams();
  const collection = useSharedCollection(collectionId);

  return (
    <VStack gap={4} padding={6}>
      <Link href="/community" label="Back to Community" type="supporting" color="secondary">
        <span className="inline-flex items-center gap-1.5">
          <Icon icon={ArrowLeft} size="sm" />
          Community
        </span>
      </Link>
      {collection.isPending && (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading</span>
          <VStack gap={3}>
            <Skeleton width={320} height={28} />
            <Skeleton height={240} />
          </VStack>
        </div>
      )}
      {collection.isError && (
        <Banner role="alert" status="error" title={errorMessage(collection.error)} />
      )}
      {collection.isSuccess && (
        <CollectionView key={collection.data.id} collection={collection.data} />
      )}
    </VStack>
  );
}
