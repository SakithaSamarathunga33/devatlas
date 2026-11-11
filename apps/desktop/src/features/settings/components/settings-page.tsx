import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { libraryQueryKey } from "@/hooks/use-library";
import { fieldClass, selectClass } from "@/lib/styles";
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

const settingsQueryKey = ["settings"] as const;
const NO_BROWSER: BookmarkSettings = { browser: null, profile: "Default", folder: "" };

/** App settings: where the library reads browser bookmarks from. */
export function SettingsPage() {
  const view = useQuery({ queryKey: settingsQueryKey, queryFn: getSettings, retry: false });

  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader title="Settings" description="Choose where your library gets its links from." />
      {view.isPending && (
        <div role="status" aria-busy="true" className="mt-5 max-w-xl">
          <span className="sr-only">Loading settings</span>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
      {view.isError && (
        <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {describeError(view.error).replace(/^.*?failed: /, "")}
        </p>
      )}
      {view.isSuccess && (
        <div className="flex max-w-xl flex-col gap-4">
          <BookmarkForm view={view.data} />
          <GithubTokenForm hasToken={view.data.hasGithubToken} />
          <LibraryTools />
        </div>
      )}
    </div>
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
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold">GitHub token</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional. Raises GitHub&apos;s limit from 60 to 5,000 requests an hour. It needs no
          permissions, and is kept in your system&apos;s credential store.
        </p>
      </div>
      {hasToken && <p className="text-sm text-primary">A token is saved.</p>}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        GitHub token
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          placeholder={hasToken ? "Paste a new token to replace it" : "ghp_…"}
          onChange={(event) => {
            setToken(event.target.value);
          }}
          className={fieldClass}
        />
      </label>
      <div className="flex justify-end gap-2">
        {hasToken && (
          <Button
            type="button"
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          >
            Remove token
          </Button>
        )}
        <Button type="submit" disabled={save.isPending || token.trim() === ""}>
          Save token
        </Button>
      </div>
    </form>
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
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">Library tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Find links that have died, back up everything you added, or import a backup or a
          browser&apos;s bookmarks file. Importing never deletes anything, but a backup&apos;s
          notes, tags and snippets replace your current versions of them.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={check.isPending}
          onClick={() => {
            check.mutate();
          }}
        >
          {check.isPending ? "Checking…" : "Check links"}
        </Button>
        <Button
          variant="outline"
          disabled={backup.isPending}
          onClick={() => {
            backup.mutate();
          }}
        >
          Export backup
        </Button>
        <Button
          variant="outline"
          disabled={restore.isPending}
          onClick={() => {
            restore.mutate();
          }}
        >
          Import
        </Button>
      </div>
    </section>
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
      toast.error("Couldn't save your settings", {
        description: describeError(error).replace(/^.*?failed: /, ""),
      });
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

  return (
    <form
      className="mt-5 flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h2 className="text-base font-semibold">Browser bookmarks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          DevAtlas can show the links in one of your browser&apos;s bookmark folders. It only ever
          reads them, and links you add here are always kept.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Browser
        <select
          value={current.browser ?? ""}
          onChange={(event) => {
            chooseBrowser(event.target.value);
          }}
          className={selectClass}
        >
          <option value="">None, only links I add</option>
          {view.options.map((option) => (
            <option key={option.browser} value={option.browser}>
              {option.label}
            </option>
          ))}
          {current.browser !== null && browser === undefined && (
            <option value={current.browser}>{current.browser} (not found)</option>
          )}
        </select>
      </label>

      {view.options.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No supported browser was found (Brave, Chrome, Edge or Vivaldi). You can still add links
          yourself in the Library.
        </p>
      )}

      {current.browser !== null && (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Profile
            <select
              value={current.profile}
              onChange={(event) => {
                chooseProfile(event.target.value);
              }}
              className={selectClass}
            >
              {profiles.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Bookmark folder
            <select
              value={current.folder}
              onChange={(event) => {
                setDraft({ ...current, folder: event.target.value });
              }}
              className={selectClass}
            >
              {folders.map((folder) => (
                <option key={folder} value={folder}>
                  {folder}
                </option>
              ))}
            </select>
          </label>
          {needsFolder && (
            <p className="text-sm text-muted-foreground">
              This profile has no bookmark folders. Create a folder of bookmarks in the browser, or
              choose another profile.
            </p>
          )}
        </>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending || needsFolder}>
          Save
        </Button>
      </div>
    </form>
  );
}
