import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { shareAgentSetup, unshareAgentSetup } from "@/services/agent-setups.service";
import { setupKinds, type SetupEntry } from "@/types/agent-setups.types";

import { setupsQueryKey, useDetectedSetup, useSharedSetup } from "../hooks/use-agent-setups";
import { useCommunitySession } from "../hooks/use-community";
import { errorMessage } from "../error-message";
import { KIND_LABELS, TOOL_LABELS, sourceLabel } from "../setup-labels";
import { GithubSignIn } from "./community-account";

/** The server's limits. */
const MAX_ITEMS = 300;
const MAX_DESCRIPTION_LENGTH = 500;

/** Everything about the item that gets published besides its name. */
function itemDescription(entry: SetupEntry): string {
  const tools = entry.tools.map((tool) => TOOL_LABELS[tool]).join(" · ");
  const where = `${sourceLabel(entry)} · ${tools}`;
  return entry.description === null ? where : `${entry.description} — ${where}`;
}

/**
 * Lists what Claude Code and Codex have installed here, lets the user pick what to share, and
 * publishes it as their one setup (or updates or unshares it). Starts from what they shared
 * before, or else from nothing: a source can be a private repository or package, so each item
 * is the user's choice ("Tick everything with a public source" is one click).
 */
export function ShareSetupDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const session = useCommunitySession();
  const userId = session.data?.id ?? null;
  const detected = useDetectedSetup();
  const current = useSharedSetup(userId);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [description, setDescription] = useState<string | null>(null);

  const isShared = current.data !== undefined && current.data !== null;
  const items = detected.data?.items ?? [];
  const sharedKeys = new Set(current.data?.items.map((entry) => entry.key));
  const installed = new Set(items.map((entry) => entry.key));
  // Only what is still installed: detection reruns when the window regains focus.
  const chosen = (picked ?? [...sharedKeys]).filter((key) => installed.has(key));
  const withSource = items.filter((entry) => entry.source !== null).map((entry) => entry.key);
  const text = description ?? current.data?.description ?? "";

  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: setupsQueryKey });
    toast.success(message);
    onClose();
  };
  const publish = useMutation({
    mutationFn: () => shareAgentSetup(chosen, text.trim() === "" ? null : text.trim()),
    onSuccess: () => done(isShared ? "Your setup was updated" : "Your setup is on Community"),
  });
  const unshare = useMutation({
    mutationFn: unshareAgentSetup,
    onSuccess: () => done("Your setup was removed from Community"),
  });

  const isSignedIn = userId !== null;
  // Until the earlier setup is known, publishing could replace it with an empty pick.
  const isLoading = detected.isPending || session.isPending || (isSignedIn && current.isPending);
  const isTooLong = text.length > MAX_DESCRIPTION_LENGTH;
  const canPublish =
    isSignedIn &&
    !isLoading &&
    !current.isError &&
    chosen.length > 0 &&
    chosen.length <= MAX_ITEMS &&
    !isTooLong;
  const failure = publish.error ?? unshare.error ?? current.error;

  return (
    <Modal purpose="form" title="Share your agent setup" onClose={onClose}>
      <VStack gap={4}>
        <Banner
          status="warning"
          title="Anyone signed in can see this"
          description="Each item you tick is shared with its name, description and source, as listed below, and your GitHub username. A source can name a private repository or package, so tick only what you want public. MCP server commands, arguments, environment variables, keys and file paths never leave this computer."
        />
        {isLoading && <Skeleton height={240} />}
        {detected.isError && (
          <Banner role="alert" status="error" title={errorMessage(detected.error)} />
        )}
        {detected.isSuccess && items.length === 0 && (
          <Text type="supporting" as="p">
            DevAtlas found no skills, MCP servers or plugins in Claude Code or Codex on this
            computer.
          </Text>
        )}
        {!isLoading && withSource.length > 0 && (
          <HStack gap={2}>
            <Button
              size="sm"
              label="Tick everything with a public source"
              onClick={() => {
                setPicked([...new Set([...chosen, ...withSource])]);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              label="Untick all"
              onClick={() => {
                setPicked([]);
              }}
            />
          </HStack>
        )}
        {!isLoading && items.length > 0 && (
          <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
            {setupKinds.map((kind) => {
              const group = items.filter((entry) => entry.kind === kind);
              if (group.length === 0) return null;
              const keys = new Set(group.map((entry) => entry.key));
              return (
                <CheckboxList
                  key={kind}
                  label={`${KIND_LABELS[kind].many} (${String(group.length)})`}
                  density="compact"
                  value={chosen.filter((key) => keys.has(key))}
                  onChange={(groupChosen) => {
                    setPicked([...chosen.filter((key) => !keys.has(key)), ...groupChosen]);
                  }}
                >
                  {group.map((entry) => (
                    <CheckboxListItem
                      key={entry.key}
                      value={entry.key}
                      label={entry.name}
                      description={itemDescription(entry)}
                    />
                  ))}
                </CheckboxList>
              );
            })}
          </div>
        )}
        {(detected.data?.skipped ?? 0) > 0 && (
          <Text type="supporting" as="p">
            {`${String(detected.data?.skipped)} left out: their names contain characters an install command can't safely hold.`}
          </Text>
        )}
        {isSignedIn && (
          <TextArea
            label="About your setup (optional)"
            value={text}
            rows={2}
            onChange={setDescription}
          />
        )}
        {isTooLong && (
          <Banner
            role="alert"
            status="error"
            title={`Use at most ${String(MAX_DESCRIPTION_LENGTH)} characters.`}
          />
        )}
        {!isLoading && items.length > 0 && chosen.length === 0 && (
          <Text type="supporting" as="p">
            {isShared
              ? "Tick at least one item to update your setup, or Unshare it."
              : "Tick the items you want to share."}
          </Text>
        )}
        {chosen.length > MAX_ITEMS && (
          <Banner
            role="alert"
            status="error"
            title={`A shared setup holds at most ${String(MAX_ITEMS)} items; you chose ${String(chosen.length)}.`}
          />
        )}
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
          {isShared && (
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
            label={isShared ? "Update" : `Share ${String(chosen.length)}`}
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
