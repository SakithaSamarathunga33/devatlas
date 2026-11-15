import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
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

/** Splits a kind's items into groups that share one source (a repo of skills) and the rest. */
function bySource(entries: SetupEntry[]): {
  repos: [SetupEntry, ...SetupEntry[]][];
  singles: SetupEntry[];
} {
  const groups = new Map<string, [SetupEntry, ...SetupEntry[]]>();
  for (const entry of entries) {
    const id = entry.source === null ? entry.key : `${entry.source.type}:${entry.source.id}`;
    const group = groups.get(id);
    groups.set(id, group === undefined ? [entry] : [...group, entry]);
  }
  const all = [...groups.values()];
  return {
    repos: all.filter((group) => group.length > 1),
    singles: all.filter((group) => group.length === 1).flat(),
  };
}

interface PickProps {
  entries: SetupEntry[];
  chosen: string[];
  onChange: (chosen: string[]) => void;
}

/** One checkbox per item; changes only these items' keys in `chosen`. */
function ItemList({ label, entries, chosen, onChange }: PickProps & { label: string }) {
  const keys = new Set(entries.map((entry) => entry.key));
  return (
    <CheckboxList
      label={label}
      isLabelHidden
      density="compact"
      value={chosen.filter((key) => keys.has(key))}
      onChange={(groupChosen) => {
        onChange([...chosen.filter((key) => !keys.has(key)), ...groupChosen]);
      }}
    >
      {entries.map((entry) => (
        <CheckboxListItem
          key={entry.key}
          value={entry.key}
          label={entry.name}
          description={itemDescription(entry)}
        />
      ))}
    </CheckboxList>
  );
}

/** Items from one repository or package: one checkbox ticks them all, single ones fold away. */
function SourceGroup({
  entries,
  chosen,
  onChange,
}: PickProps & { entries: [SetupEntry, ...SetupEntry[]] }) {
  const [first] = entries;
  const name = first.source?.id ?? first.name;
  const keys = entries.map((entry) => entry.key);
  const ticked = keys.filter((key) => chosen.includes(key)).length;
  const kind = KIND_LABELS[first.kind].many.toLowerCase();
  let value: boolean | "indeterminate" = "indeterminate";
  if (ticked === 0) value = false;
  else if (ticked === keys.length) value = true;
  return (
    <VStack gap={1}>
      <CheckboxInput
        label={name}
        description={`${String(keys.length)} ${kind} · ${String(ticked)} ticked · ${sourceLabel(first)}`}
        value={value}
        onChange={(isChecked) => {
          const rest = chosen.filter((key) => !keys.includes(key));
          onChange(isChecked ? [...rest, ...keys] : rest);
        }}
      />
      <Collapsible
        className="pl-7"
        defaultIsOpen={false}
        trigger={<Text type="supporting">{`Pick single ${kind} from ${name}`}</Text>}
      >
        <ItemList label={name} entries={entries} chosen={chosen} onChange={onChange} />
      </Collapsible>
    </VStack>
  );
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
          <div className="space-y-4">
            {setupKinds.map((kind) => {
              const group = items.filter((entry) => entry.kind === kind);
              if (group.length === 0) return null;
              const { repos, singles } = bySource(group);
              const label = `${KIND_LABELS[kind].many} (${String(group.length)})`;
              return (
                <VStack key={kind} gap={2}>
                  <Heading level={4} accessibilityLevel={3}>
                    {label}
                  </Heading>
                  {repos.map((repo) => (
                    <SourceGroup
                      key={repo[0].key}
                      entries={repo}
                      chosen={chosen}
                      onChange={setPicked}
                    />
                  ))}
                  {singles.length > 0 && (
                    <ItemList
                      label={label}
                      entries={singles}
                      chosen={chosen}
                      onChange={setPicked}
                    />
                  )}
                </VStack>
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
        {/* Pinned so the buttons stay in view while the long list scrolls the dialog. */}
        <div className="sticky bottom-0 z-10 -mb-5 bg-(--color-background-popover) pt-3 pb-5">
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
        </div>
      </VStack>
    </Modal>
  );
}
