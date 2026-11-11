import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { getAgentConnection, importGithubStars } from "@/services/agent.service";
import { describeError } from "@/services/ipc";
import type { AgentConnection } from "@/types/agent.types";

import { SettingsSection } from "./settings-section";

function errorText(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

/** The command that registers DevAtlas with Claude Code, for every folder it runs in. */
function claudeCommand(executable: string): string {
  return `claude mcp add devatlas -s user -- "${executable}" --mcp`;
}

/** The entry most other agents (Cursor, Windsurf, Codex) read from an `mcp.json`. */
function mcpJson(executable: string): string {
  return JSON.stringify(
    { mcpServers: { devatlas: { command: executable, args: ["--mcp"] } } },
    null,
    2,
  );
}

function Usage({ usage }: { usage: AgentConnection["usage"] }) {
  if (usage.lookups === 0) {
    return (
      <Text type="supporting" as="p">
        No lookups in the last 7 days. Connect an agent, then ask it about a library you saved.
      </Text>
    );
  }
  return (
    <Text type="supporting" as="p">
      {usage.lookups} {usage.lookups === 1 ? "lookup" : "lookups"} in the last 7 days
      {usage.lastAt !== null && (
        <>
          , most recently <Timestamp value={usage.lastAt} format="relative" hasTooltip={false} />
        </>
      )}
      .
    </Text>
  );
}

/** How to let an AI coding agent use the library, and how often it has. */
export function AgentConnectionSettings() {
  const connection = useQuery({
    queryKey: ["agent-connection"],
    queryFn: getAgentConnection,
    retry: false,
  });

  return (
    <SettingsSection
      title="AI coding agents"
      description="Let Claude Code, Cursor and other MCP agents search your library, read your notes and snippets, and see what you've saved about a project's dependencies. They can't change anything, but what they read is sent to the AI service the agent uses, like anything else it reads."
    >
      <VStack gap={4}>
        {connection.isPending && <Skeleton height={160} />}
        {connection.isError && (
          <Banner status="error" role="alert" title={errorText(connection.error)} />
        )}
        {connection.isSuccess && (
          <>
            <VStack gap={2}>
              <Heading level={3}>Claude Code</Heading>
              <CodeBlock
                code={claudeCommand(connection.data.executable)}
                language="bash"
                isWrapped
              />
            </VStack>
            <VStack gap={2}>
              <Heading level={3}>Other agents</Heading>
              <CodeBlock code={mcpJson(connection.data.executable)} language="json" isWrapped />
            </VStack>
            <Usage usage={connection.data.usage} />
          </>
        )}
      </VStack>
    </SettingsSection>
  );
}

/** Imports the repositories someone starred on GitHub into the library. */
export function GithubStarsSettings() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [added, setAdded] = useState<number | null>(null);
  const importStars = useMutation({
    mutationFn: () => importGithubStars(username),
    onSuccess: async (count) => {
      setAdded(count);
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error("Couldn't import the stars", { description: errorText(error) });
    },
  });

  return (
    <SettingsSection
      title="GitHub stars"
      description="The repositories you starred are bookmarks you already keep. Import up to 1,000 of them; ones already in your library are skipped."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (username.trim() !== "" && !importStars.isPending) importStars.mutate();
        }}
      >
        <VStack gap={4}>
          <TextInput
            label="GitHub username"
            autoComplete="off"
            hasSpellCheck={false}
            placeholder="octocat"
            value={username}
            onChange={(value) => {
              setUsername(value);
              setAdded(null);
            }}
          />
          {added !== null && (
            <Banner
              status="success"
              title={
                added === 0
                  ? "No new repositories"
                  : `Added ${String(added)} ${added === 1 ? "repository" : "repositories"}`
              }
            />
          )}
          <HStack gap={2} hAlign="end">
            <Button
              type="submit"
              label="Import stars"
              variant="primary"
              isLoading={importStars.isPending}
              isDisabled={username.trim() === ""}
            />
          </HStack>
        </VStack>
      </form>
    </SettingsSection>
  );
}
