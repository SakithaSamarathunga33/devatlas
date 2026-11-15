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
import { ArrowLeft, Copy, Flag, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

import { SaveRepoButton } from "@/features/discovery";
import { WebLink } from "@/features/news";
import { useLibrary } from "@/hooks/use-library";
import { reportSharedSetup, unshareAgentSetup } from "@/services/agent-setups.service";
import { setupKinds, type SetupEntry, type SharedSetup } from "@/types/agent-setups.types";

import { setupQueryKey, useSharedSetup } from "../hooks/use-agent-setups";
import { useCommunitySession } from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { KIND_LABELS, TOOL_LABELS, setupCounts, sourceLabel } from "../setup-labels";
import { ReportDialog, UnshareDialog } from "./collection-dialogs";
import { OwnerAvatar } from "./community-account";
import { CommunitySignInGate } from "./community-sign-in-gate";
import { ShareSetupDialog } from "./share-setup-dialog";

function copy(command: string) {
  navigator.clipboard
    .writeText(command)
    .then(() => {
      toast.success("Copied. Read it before you run it.");
    })
    .catch((error: unknown) => {
      toast.error("Couldn't copy the command", { description: errorMessage(error) });
    });
}

/** Commands are built by DevAtlas from checked names, never taken from the setup's owner, and
 * shown in full so the reader sees exactly what they copy. */
function InstallCommands({ entry }: { entry: SetupEntry }) {
  if (entry.install.length === 0) {
    return (
      <Text type="supporting" size="xsm">
        No install command: it has no public source.
      </Text>
    );
  }
  return (
    <VStack gap={1}>
      {entry.install.map((install) => {
        const agent = install.tool === null ? null : TOOL_LABELS[install.tool];
        return (
          <HStack key={install.command} gap={2} vAlign="center">
            <div className="min-w-0 flex-1 break-all whitespace-pre-wrap">
              <Text type="code" size="xsm" color="secondary">
                {install.command}
              </Text>
            </div>
            <Button
              variant="ghost"
              size="sm"
              label={
                agent === null
                  ? `Copy the install command for ${entry.name}`
                  : `Copy the ${agent} command for ${entry.name}`
              }
              tooltip={agent === null ? "Copy" : `Copy for ${agent}`}
              icon={<Icon icon={Copy} />}
              isIconOnly
              onClick={() => {
                copy(install.command);
              }}
            />
          </HStack>
        );
      })}
    </VStack>
  );
}

function SetupItemRow({ entry, isSaved }: { entry: SetupEntry; isSaved: boolean }) {
  const tools = entry.tools.map((tool) => TOOL_LABELS[tool]).join(" · ");
  return (
    <ListItem
      label={
        <Text weight="medium" maxLines={1}>
          {entry.link === null ? entry.name : <WebLink href={entry.link.url}>{entry.name}</WebLink>}
        </Text>
      }
      description={
        <VStack gap={2}>
          {entry.description !== null && (
            <Text type="supporting" maxLines={2}>
              {entry.description}
            </Text>
          )}
          <Text type="supporting" size="xsm">
            {sourceLabel(entry)} · {tools}
          </Text>
          <InstallCommands entry={entry} />
        </VStack>
      }
      endContent={
        entry.link !== null && (
          <SaveRepoButton
            repo={{ fullName: entry.name, url: entry.link.url }}
            saved={isSaved}
            compact
          />
        )
      }
    />
  );
}

function SetupView({ setup }: { setup: SharedSetup }) {
  const session = useCommunitySession();
  const library = useLibrary();
  const [dialog, setDialog] = useState<"report" | "unshare" | "edit" | null>(null);
  const savedIds = new Set(library.data?.resources.map((resource) => resource.id.toLowerCase()));
  const user = session.data ?? null;
  const isOwner = user !== null && user.id === setup.owner.id;
  const close = () => {
    setDialog(null);
  };
  const counts = setupCounts({
    skill: setup.skillCount,
    "mcp-server": setup.mcpServerCount,
    plugin: setup.pluginCount,
  });

  return (
    <VStack gap={5}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <VStack gap={2} className="min-w-0">
          <Heading level={1}>{`${setup.owner.username}'s agent setup`}</Heading>
          <HStack gap={2} vAlign="center">
            <OwnerAvatar src={setup.owner.avatarUrl} className="size-6" />
            <Text type="supporting">
              {counts} · updated{" "}
              <Timestamp value={setup.updatedAt} format="relative" hasTooltip={false} />
            </Text>
          </HStack>
          {setup.description !== null && (
            <Text as="p" color="secondary">
              {setup.description}
            </Text>
          )}
        </VStack>
        <HStack gap={2} vAlign="center">
          {isOwner ? (
            <>
              <Button
                label="Update"
                icon={<Icon icon={Pencil} />}
                onClick={() => {
                  setDialog("edit");
                }}
              />
              <Button
                variant="ghost"
                label="Unshare"
                icon={<Icon icon={Trash2} />}
                onClick={() => {
                  setDialog("unshare");
                }}
              />
            </>
          ) : (
            user !== null && (
              <Button
                variant="ghost"
                label="Report"
                icon={<Icon icon={Flag} />}
                onClick={() => {
                  setDialog("report");
                }}
              />
            )
          )}
        </HStack>
      </div>

      {setup.items.length === 0 && (
        <EmptyState headingLevel={2} title="This setup has nothing in it." />
      )}
      {setupKinds.map((kind) => {
        const entries = setup.items.filter((entry) => entry.kind === kind);
        if (entries.length === 0) return null;
        return (
          <VStack key={kind} gap={2}>
            <Heading level={4} accessibilityLevel={2}>
              {`${KIND_LABELS[kind].many} (${String(entries.length)})`}
            </Heading>
            <List hasDividers>
              {entries.map((entry) => (
                <SetupItemRow
                  key={entry.key}
                  entry={entry}
                  isSaved={entry.link !== null && savedIds.has(entry.link.libraryId.toLowerCase())}
                />
              ))}
            </List>
          </VStack>
        );
      })}

      {dialog === "report" && (
        <ReportDialog
          name={`${setup.owner.username}'s agent setup`}
          what="setup"
          send={(reason) => reportSharedSetup(setup.owner.id, reason)}
          onClose={close}
        />
      )}
      {dialog === "unshare" && (
        <UnshareDialog
          what="setup"
          send={unshareAgentSetup}
          pageQueryKey={setupQueryKey(setup.owner.id)}
          returnTo="/community?tab=setups"
          onClose={close}
        />
      )}
      {dialog === "edit" && <ShareSetupDialog onClose={close} />}
    </VStack>
  );
}

/** One developer's shared Claude Code and Codex setup. Signed in only. */
export function SharedSetupPage() {
  return (
    <CommunitySignInGate>
      <SharedSetupContent />
    </CommunitySignInGate>
  );
}

function SharedSetupContent() {
  const { ownerId = "" } = useParams();
  const setup = useSharedSetup(ownerId);

  return (
    <VStack gap={4} padding={6}>
      <Link
        href="/community?tab=setups"
        label="Back to Community"
        type="supporting"
        color="secondary"
      >
        <span className="inline-flex items-center gap-1.5">
          <Icon icon={ArrowLeft} size="sm" />
          Community
        </span>
      </Link>
      {setup.isPending && (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading</span>
          <VStack gap={3}>
            <Skeleton width={320} height={28} />
            <Skeleton height={240} />
          </VStack>
        </div>
      )}
      {setup.isError && <Banner role="alert" status="error" title={errorMessage(setup.error)} />}
      {setup.isSuccess &&
        (setup.data === null ? (
          <EmptyState headingLevel={1} title="This setup isn't shared any more." />
        ) : (
          <SetupView key={setup.data.owner.id} setup={setup.data} />
        ))}
    </VStack>
  );
}
