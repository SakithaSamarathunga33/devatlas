import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { primaryNavigation, secondaryNavigation } from "@/components/layout/navigation";
import { Modal } from "@/components/shared/modal";
import { useGroups } from "@/hooks/use-groups";
import { useLibrary } from "@/hooks/use-library";
import { useSnippets } from "@/hooks/use-snippets";
import { fieldClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 30;

interface Entry {
  key: string;
  kind: string;
  title: string;
  detail: string;
  to: string;
  /** Everything searchable, lowercased. */
  text: string;
}

/** The site viewer is a native webview above the app, so nothing can appear over it. */
function isViewerRoute(pathname: string): boolean {
  return (
    /^\/library\/.+/.test(pathname) ||
    pathname.startsWith("/news/view") ||
    pathname.startsWith("/discovery/view") ||
    pathname.startsWith("/explorer/view")
  );
}

/** Ctrl K search across pages, links, collections and snippets. */
export function CommandPalette() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const blocked = isViewerRoute(pathname);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!blocked) setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [blocked]);

  return (
    <>
      <button
        type="button"
        disabled={blocked}
        aria-label="Search everything (Ctrl K)"
        onClick={() => {
          setOpen(true);
        }}
        className="relative flex h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-input bg-card px-3.5 text-sm text-muted-foreground outline-none hover:border-foreground/20 focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
      >
        <Search aria-hidden className="size-4" />
        Search everything…
        <kbd className="ml-auto rounded border border-input bg-secondary px-1.5 py-0.5 font-sans text-[11px]">
          Ctrl K
        </kbd>
      </button>
      {open && (
        <Palette
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function useEntries(): Entry[] {
  const library = useLibrary();
  const groups = useGroups();
  const snippets = useSnippets();

  const pages: Entry[] = [...primaryNavigation, ...secondaryNavigation].flatMap((item) =>
    item.to === undefined
      ? []
      : [
          {
            key: `page:${item.to}`,
            kind: "Page",
            title: item.label,
            detail: "",
            to: item.to,
            text: item.label.toLowerCase(),
          },
        ],
  );
  const links: Entry[] = (library.data?.resources ?? []).map((resource) => ({
    key: `link:${resource.id}`,
    kind: "Link",
    title: resource.title,
    detail: resource.host,
    to: `/library/${encodeURIComponent(resource.id)}`,
    text: [resource.title, resource.host, resource.note ?? "", ...resource.tags]
      .join(" ")
      .toLowerCase(),
  }));
  const named: Entry[] = (groups.data ?? []).map((group) => ({
    key: `group:${group.id}`,
    kind: "Collection",
    title: group.name,
    detail: group.description ?? "",
    to: `/collections/${encodeURIComponent(group.id)}`,
    text: `${group.name} ${group.description ?? ""}`.toLowerCase(),
  }));
  const code: Entry[] = (snippets.data ?? []).map((snippet) => ({
    key: `snippet:${snippet.id}`,
    kind: "Snippet",
    title: snippet.title,
    detail: snippet.language ?? "",
    to: `/snippets?q=${encodeURIComponent(snippet.title)}`,
    text: [snippet.title, snippet.language ?? "", snippet.code, ...snippet.tags]
      .join(" ")
      .toLowerCase(),
  }));
  return [...pages, ...links, ...named, ...code];
}

function search(entries: readonly Entry[], query: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.filter((entry) => entry.kind === "Page");
  const first = words.join(" ");
  return entries
    .filter((entry) => words.every((word) => entry.text.includes(word)))
    .sort(
      (a, b) =>
        Number(b.title.toLowerCase().startsWith(first)) -
        Number(a.title.toLowerCase().startsWith(first)),
    )
    .slice(0, MAX_RESULTS);
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const entries = useEntries();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = search(entries, query);
  const selected = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    document.getElementById(`palette-${String(selected)}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const openEntry = (entry: Entry | undefined) => {
    if (entry === undefined) return;
    onClose();
    void navigate(entry.to);
  };

  return (
    <Modal title="Search everything" onClose={onClose}>
      <input
        role="combobox"
        aria-label="Search"
        aria-expanded={results.length > 0}
        aria-autocomplete="list"
        aria-controls={results.length > 0 ? "palette-results" : undefined}
        aria-activedescendant={results.length > 0 ? `palette-${String(selected)}` : undefined}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        placeholder="Links, tags, notes, collections, snippets…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive(Math.max(0, Math.min(selected + 1, results.length - 1)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(Math.max(selected - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            openEntry(results[selected]);
          }
        }}
        className={`mt-3 ${fieldClass}`}
      />
      {results.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing found.</p>
      ) : (
        <ul
          id="palette-results"
          role="listbox"
          aria-label="Results"
          className="mt-2 max-h-96 overflow-y-auto"
        >
          {results.map((entry, index) => (
            <li
              key={entry.key}
              id={`palette-${String(index)}`}
              role="option"
              aria-selected={index === selected}
              onClick={() => {
                openEntry(entry);
              }}
              onMouseMove={() => {
                setActive(index);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                index === selected && "bg-secondary",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{entry.title}</span>
                {entry.detail !== "" && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.detail}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{entry.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
