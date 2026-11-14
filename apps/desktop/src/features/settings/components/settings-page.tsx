import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { libraryQueryKey } from "@/hooks/use-library";
import { describeError } from "@/services/ipc";
import {
  checkLinks,
  clearGithubToken,
  exportBackup,
  getSettings,
  importFile,
  setGithubToken,
  updateSettings,
} from "@/services/settings.service";
import type { BookmarkSettings, SettingsView } from "@/types/settings.types";

import { AccountSettings } from "./account-settings";
import { AgentConnectionSettings, GithubStarsSettings } from "./agent-settings";
import { SettingsSection } from "./settings-section";

const settingsQueryKey = ["settings"] as const;
const NO_BROWSER: BookmarkSettings = { browser: null, profile: "Default", folder: "" };

/** App settings: where the library reads browser bookmarks from. */
export function SettingsPage() {
  const view = useQuery({ queryKey: settingsQueryKey, queryFn: getSettings, retry: false });

  return (
    <VStack padding={6}>
      <VStack gap={6}>
        <PageHeader title="Settings" description="Choose where your library gets its links from." />
        <AccountSettings />
        <Divider />
        {view.isPending && (
          <div role="status" aria-busy="true" className="max-w-xl">
            <VisuallyHidden>Loading settings</VisuallyHidden>
            <Skeleton height={256} />
          </div>
        )}
        {view.isError && <Banner status="error" role="alert" title={errorText(view.error)} />}
        {view.isSuccess && (
          <VStack gap={8}>
            <BookmarkForm view={view.data} />
            <Divider />
            <AgentConnectionSettings />
            <Divider />
            <GithubStarsSettings />
            <Divider />
            <GithubTokenForm hasToken={view.data.hasGithubToken} />
            <Divider />
            <LibraryTools />
          </VStack>
        )}
      </VStack>
    </VStack>
  );
}

function plural(count: number, noun: string): string {
  return `${String(count)} ${noun}${count === 1 ? "" : "s"}`;
}

function errorText(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

/** An optional token that raises GitHub's limit. It is sent to Rust and never shown again. */
function GithubTokenForm({ hasToken }: { hasToken: boolean }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: settingsQueryKey });
  const save = useMutation({
    mutationFn: () => setGithubToken(token),
    onSuccess: async () => {
      setToken("");
      await refresh();
      toast.success("GitHub token saved");
    },
    onError: (error) => {
      toast.error("Couldn't save the token", { description: errorText(error) });
    },
  });
  const remove = useMutation({
    mutationFn: clearGithubToken,
    onSuccess: refresh,
    onError: (error) => {
      toast.error("Couldn't remove the token", { description: errorText(error) });
    },
  });

  return (
    <SettingsSection
      title="GitHub token"
      description="Optional. Raises GitHub's limit from 60 to 5,000 requests an hour. It needs no permissions, and is kept in your system's credential store."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <VStack gap={4}>
          {hasToken && <Banner status="success" title="A token is saved." />}
          <FormLayout>
            <TextInput
              type="password"
              label="GitHub token"
              autoComplete="off"
              hasSpellCheck={false}
              value={token}
              placeholder={hasToken ? "Paste a new token to replace it" : "ghp_…"}
              onChange={setToken}
            />
          </FormLayout>
          <HStack gap={2} hAlign="end">
            {hasToken && (
              <Button
                label="Remove token"
                variant="ghost"
                isDisabled={remove.isPending}
                onClick={() => {
                  remove.mutate();
                }}
              />
            )}
            <Button
              type="submit"
              label="Save token"
              variant="primary"
              isDisabled={save.isPending || token.trim() === ""}
            />
          </HStack>
        </VStack>
      </form>
    </SettingsSection>
  );
}

/** Link checking, backup and import. */
function LibraryTools() {
  const queryClient = useQueryClient();
  const refreshAll = () => queryClient.invalidateQueries();
  const check = useMutation({
    mutationFn: checkLinks,
    onSuccess: async ({ checked, broken, moved, unknown }) => {
      await refreshAll();
      toast.success(`Checked ${plural(checked, "link")}`, {
        description: `${String(broken)} broken, ${String(moved)} moved, ${String(unknown)} couldn't be confirmed.`,
      });
    },
    onError: (error) => {
      toast.error("Couldn't check the links", { description: errorText(error) });
    },
  });
  const backup = useMutation({
    mutationFn: exportBackup,
    onSuccess: (name) => {
      if (name !== null) toast.success("Backup saved", { description: name });
    },
    onError: (error) => {
      toast.error("Couldn't save the backup", { description: errorText(error) });
    },
  });
  const restore = useMutation({
    mutationFn: importFile,
    onSuccess: async (summary) => {
      if (summary === null) return;
      await refreshAll();
      toast.success("Import complete", {
        description: `${plural(summary.links, "link")}, ${plural(summary.groups, "group")}, ${plural(summary.snippets, "snippet")}.`,
      });
    },
    onError: (error) => {
      toast.error("Couldn't import that file", { description: errorText(error) });
    },
  });

  return (
    <SettingsSection
      title="Library tools"
      description="Find links that have died, back up everything you added, or import a backup or a browser's bookmarks file. Importing never deletes anything, but a backup's notes, tags and snippets replace your current versions of them."
    >
      <HStack gap={2} wrap="wrap">
        <Button
          label={check.isPending ? "Checking…" : "Check links"}
          isLoading={check.isPending}
          onClick={() => {
            check.mutate();
          }}
        />
        <Button
          label="Export backup"
          isLoading={backup.isPending}
          onClick={() => {
            backup.mutate();
          }}
        />
        <Button
          label="Import"
          isLoading={restore.isPending}
          onClick={() => {
            restore.mutate();
          }}
        />
      </HStack>
    </SettingsSection>
  );
}

function BookmarkForm({ view }: { view: SettingsView }) {
  const queryClient = useQueryClient();
  // Unsaved changes; `null` shows what is stored.
  const [draft, setDraft] = useState<BookmarkSettings | null>(null);
  const current = draft ?? view.settings;

  const browser = view.options.find((option) => option.browser === current.browser);
  const found = browser?.profiles ?? [];
  // A stored choice stays selectable even if the browser no longer reports it.
  const profiles = found.some((profile) => profile.id === current.profile)
    ? found
    : [...found, { id: current.profile, name: current.profile, folders: [] }];
  const profile = profiles.find((item) => item.id === current.profile);
  const listed = profile?.folders ?? [];
  const folders =
    current.folder === "" || listed.includes(current.folder) ? listed : [...listed, current.folder];

  const save = useMutation({
    mutationFn: () => updateSettings(current),
    onSuccess: async (saved) => {
      queryClient.setQueryData(settingsQueryKey, saved);
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error("Couldn't save your settings", { description: errorText(error) });
    },
  });

  const chooseBrowser = (value: string) => {
    const option = view.options.find((item) => item.browser === value);
    const first = option?.profiles[0];
    setDraft(
      option === undefined || first === undefined
        ? NO_BROWSER
        : { browser: option.browser, profile: first.id, folder: first.folders[0] ?? "" },
    );
  };
  const chooseProfile = (value: string) => {
    const next = profiles.find((item) => item.id === value);
    setDraft({ ...current, profile: value, folder: next?.folders[0] ?? "" });
  };

  const needsFolder = current.browser !== null && current.folder === "";
  const browserOptions = [
    { value: "", label: "None, only links I add" },
    ...view.options.map((option) => ({ value: option.browser, label: option.label })),
    ...(current.browser !== null && browser === undefined
      ? [{ value: current.browser, label: `${current.browser} (not found)` }]
      : []),
  ];

  return (
    <SettingsSection
      title="Browser bookmarks"
      description="DevAtlas can show the links in one of your browser's bookmark folders. It only ever reads them, and links you add here are always kept."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <VStack gap={4}>
          <FormLayout>
            <Selector
              label="Browser"
              options={browserOptions}
              value={current.browser ?? ""}
              onChange={chooseBrowser}
            />
            {current.browser !== null && (
              <>
                <Selector
                  label="Profile"
                  options={profiles.map((item) => ({ value: item.id, label: item.name }))}
                  value={current.profile}
                  onChange={chooseProfile}
                />
                <Selector
                  label="Bookmark folder"
                  options={folders}
                  value={current.folder}
                  placeholder="No folders"
                  onChange={(folder) => {
                    setDraft({ ...current, folder });
                  }}
                />
              </>
            )}
          </FormLayout>
          {view.options.length === 0 && (
            <Banner
              status="info"
              title="No supported browser was found"
              description="DevAtlas looks for Brave, Chrome, Edge and Vivaldi. You can still add links yourself in the Library."
            />
          )}
          {needsFolder && (
            <Banner
              status="warning"
              title="This profile has no bookmark folders"
              description="Create a folder of bookmarks in the browser, or choose another profile."
            />
          )}
          <HStack hAlign="end">
            <Button
              type="submit"
              label="Save"
              variant="primary"
              isDisabled={save.isPending || needsFolder}
            />
          </HStack>
        </VStack>
      </form>
    </SettingsSection>
  );
}
