import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLibrary } from "@/hooks/use-library";
import { snippetsQueryKey, useSnippets } from "@/hooks/use-snippets";
import { fieldClass, selectClass } from "@/lib/styles";
import { describeError } from "@/services/ipc";
import { createSnippet, deleteSnippet, updateSnippet } from "@/services/snippets.service";
import type { Snippet } from "@/types/snippets.types";

function message(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

function matches(snippet: Snippet, term: string): boolean {
  return [snippet.title, snippet.language ?? "", snippet.code, ...snippet.tags].some((text) =>
    text.toLowerCase().includes(term),
  );
}

/** Small pieces of code worth keeping. Search lives in `?q=`. */
export function SnippetsPage() {
  const snippets = useSnippets();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const search = params.get("q") ?? "";
  const term = search.trim().toLowerCase();
  const all = snippets.data ?? [];
  const visible = all.filter((snippet) => term === "" || matches(snippet, term));

  return (
    <div className="w-full px-5 pt-5 pb-16 lg:px-8">
      <PageHeader title="Snippets" description="Small pieces of code worth keeping.">
        <div className="flex max-w-xl min-w-0 flex-1 basis-80 items-center gap-2">
          <SearchField
            value={search}
            onChange={(value) => {
              setParams(value === "" ? {} : { q: value }, { replace: true });
            }}
            label="Search snippets"
            placeholder="Search…"
          />
          <Button
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus aria-hidden />
            New snippet
          </Button>
        </div>
      </PageHeader>

      {snippets.isPending && (
        <div role="status" aria-busy="true" className="mt-5 grid gap-3 lg:grid-cols-2">
          <span className="sr-only">Loading snippets</span>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      )}
      {snippets.isError && (
        <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {message(snippets.error)}
        </p>
      )}
      {snippets.isSuccess && all.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No snippets yet. Save the few lines you always look up.
        </p>
      )}
      {snippets.isSuccess && all.length > 0 && visible.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No snippets match &ldquo;{search}&rdquo;.
        </p>
      )}
      {visible.length > 0 && (
        <ul className="mt-5 grid gap-3 lg:grid-cols-2">
          {visible.map((snippet) => (
            <li key={snippet.id}>
              <SnippetCard snippet={snippet} />
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <SnippetForm
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

type Dialog = "edit" | "delete" | null;

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const library = useLibrary();
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = () => {
    setDialog(null);
  };
  const attached = library.data?.resources.find(
    (resource) => resource.id === snippet.resourceId,
  )?.title;

  const copy = () => {
    navigator.clipboard
      .writeText(snippet.code)
      .then(() => {
        toast.success("Copied");
      })
      .catch((error: unknown) => {
        toast.error("Couldn't copy the snippet", { description: message(error) });
      });
  };

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{snippet.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {snippet.language !== null && <span>{snippet.language}</span>}
            {snippet.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-2 py-px">
                {tag}
              </span>
            ))}
            {attached !== undefined && <span className="text-primary">{attached}</span>}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Copy ${snippet.title}`}
          title="Copy"
          onClick={copy}
          className="size-8 text-muted-foreground"
        >
          <Copy aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${snippet.title}`}
          title="Edit"
          onClick={() => {
            setDialog("edit");
          }}
          className="size-8 text-muted-foreground"
        >
          <Pencil aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Delete ${snippet.title}`}
          title="Delete"
          onClick={() => {
            setDialog("delete");
          }}
          className="size-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      <pre className="mt-3 max-h-64 flex-1 overflow-auto rounded-lg bg-secondary p-3 font-mono text-xs">
        <code>{snippet.code}</code>
      </pre>
      {dialog === "edit" && <SnippetForm snippet={snippet} onClose={closeDialog} />}
      {dialog === "delete" && <DeleteDialog snippet={snippet} onClose={closeDialog} />}
    </article>
  );
}

function SnippetForm({ snippet, onClose }: { snippet?: Snippet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const library = useLibrary();
  const [title, setTitle] = useState(snippet?.title ?? "");
  const [language, setLanguage] = useState(snippet?.language ?? "");
  const [code, setCode] = useState(snippet?.code ?? "");
  const [tags, setTags] = useState(snippet?.tags.join(", ") ?? "");
  const [resourceId, setResourceId] = useState(snippet?.resourceId ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const input = {
        title,
        language: language.trim() === "" ? null : language,
        code,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ""),
        resourceId: resourceId === "" ? null : resourceId,
      };
      if (snippet === undefined) await createSnippet(input);
      else await updateSnippet(snippet.id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snippetsQueryKey });
      onClose();
    },
  });

  return (
    <Modal title={snippet === undefined ? "New snippet" : "Edit snippet"} onClose={onClose}>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Title
          <input
            value={title}
            autoFocus
            onChange={(event) => {
              setTitle(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Language
          <input
            value={language}
            placeholder="TypeScript"
            onChange={(event) => {
              setLanguage(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Code
          <textarea
            value={code}
            rows={8}
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value);
            }}
            className={`${fieldClass} font-mono text-xs`}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Tags
          <input
            value={tags}
            placeholder="react, hooks"
            onChange={(event) => {
              setTags(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Link
          <select
            value={resourceId}
            onChange={(event) => {
              setResourceId(event.target.value);
            }}
            className={selectClass}
          >
            <option value="">None</option>
            {library.data?.resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.title}
              </option>
            ))}
          </select>
        </label>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {message(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={save.isPending || title.trim() === "" || code.trim() === ""}
          >
            {snippet === undefined ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ snippet, onClose }: { snippet: Snippet; onClose: () => void }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteSnippet(snippet.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: snippetsQueryKey });
      onClose();
    },
  });

  return (
    <Modal title={`Delete “${snippet.title}”?`} onClose={onClose}>
      <p className="mt-2 text-sm text-muted-foreground">This can&apos;t be undone.</p>
      {remove.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {message(remove.error)}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate();
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
