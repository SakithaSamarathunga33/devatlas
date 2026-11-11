import { Button } from "@astryxdesign/core/Button";
import {
  CommandPalette as AstryxCommandPalette,
  CommandPaletteInput,
  useCommandPaletteContext,
} from "@astryxdesign/core/CommandPalette";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Kbd } from "@astryxdesign/core/Kbd";
import { Text } from "@astryxdesign/core/Text";
import type { SearchableItem, SearchSource } from "@astryxdesign/core/Typeahead";
import { VStack } from "@astryxdesign/core/VStack";
import { Search } from "lucide-react";
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";

import { primaryNavigation, secondaryNavigation } from "@/components/layout/navigation";
import { useGroups } from "@/hooks/use-groups";
import { useLibrary } from "@/hooks/use-library";
import { useSnippets } from "@/hooks/use-snippets";

const MAX_RESULTS = 30;
const PAGES = "Pages";

interface Entry extends SearchableItem<{ group: string }> {
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
      <Button
        label="Search everything (Ctrl K)"
        icon={<Icon icon={Search} />}
        isDisabled={blocked}
        onClick={() => {
          setOpen(true);
        }}
      >
        <HStack as="span" gap={3} vAlign="center">
          <span>Search everything…</span>
          <Kbd keys="mod+k" />
        </HStack>
      </Button>
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
  const { data: library } = useLibrary();
  const { data: groups } = useGroups();
  const { data: snippets } = useSnippets();

  return useMemo(() => {
    const pages: Entry[] = [...primaryNavigation, ...secondaryNavigation].flatMap((item) =>
      item.to === undefined
        ? []
        : [
            {
              id: `page:${item.to}`,
              label: item.label,
              auxiliaryData: { group: PAGES },
              detail: "",
              to: item.to,
              text: item.label.toLowerCase(),
            },
          ],
    );
    const links: Entry[] = (library?.resources ?? []).map((resource) => ({
      id: `link:${resource.id}`,
      label: resource.title,
      auxiliaryData: { group: "Links" },
      detail: resource.host,
      to: `/library/${encodeURIComponent(resource.id)}`,
      text: [resource.title, resource.host, resource.note ?? "", ...resource.tags]
        .join(" ")
        .toLowerCase(),
    }));
    const named: Entry[] = (groups ?? []).map((group) => ({
      id: `group:${group.id}`,
      label: group.name,
      auxiliaryData: { group: "Collections" },
      detail: group.description ?? "",
      to: `/collections/${encodeURIComponent(group.id)}`,
      text: `${group.name} ${group.description ?? ""}`.toLowerCase(),
    }));
    const code: Entry[] = (snippets ?? []).map((snippet) => ({
      id: `snippet:${snippet.id}`,
      label: snippet.title,
      auxiliaryData: { group: "Snippets" },
      detail: snippet.language ?? "",
      to: `/snippets?q=${encodeURIComponent(snippet.title)}`,
      text: [snippet.title, snippet.language ?? "", snippet.code, ...snippet.tags]
        .join(" ")
        .toLowerCase(),
    }));
    return [...pages, ...links, ...named, ...code];
  }, [library, groups, snippets]);
}

function search(entries: readonly Entry[], query: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.filter((entry) => entry.auxiliaryData?.group === PAGES);
  const first = words.join(" ");
  return entries
    .filter((entry) => words.every((word) => entry.text.includes(word)))
    .sort(
      (a, b) =>
        Number(b.label.toLowerCase().startsWith(first)) -
        Number(a.label.toLowerCase().startsWith(first)),
    )
    .slice(0, MAX_RESULTS);
}

/**
 * Astryx only searches when the query changes and starts with nothing highlighted, so this
 * re-runs the query when links, collections or snippets finish loading, and keeps the top
 * result highlighted so Enter opens it.
 */
function PaletteInput({ entries }: { entries: readonly Entry[] }) {
  const palette = useCommandPaletteContext();
  const rerun = useEffectEvent(() => {
    palette?.setSearch(palette.search);
  });
  useEffect(() => {
    rerun();
  }, [entries]);

  const highlighted = palette?.highlightedIndex;
  const hasResults = (palette?.selectableItems.length ?? 0) > 0;
  const setHighlighted = palette?.setHighlightedIndex;
  useEffect(() => {
    if (highlighted === -1 && hasResults) setHighlighted?.(0);
  }, [highlighted, hasResults, setHighlighted]);

  return (
    <CommandPaletteInput label="Search" placeholder="Links, tags, notes, collections, snippets…" />
  );
}

function renderEntry(entry: Entry) {
  return (
    <VStack gap={0}>
      <Text maxLines={1}>{entry.label}</Text>
      {entry.detail !== "" && (
        <Text type="supporting" maxLines={1}>
          {entry.detail}
        </Text>
      )}
    </VStack>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const entries = useEntries();
  const source = useMemo<SearchSource<Entry>>(
    () => ({
      bootstrap: () => search(entries, ""),
      search: (query) => search(entries, query),
    }),
    [entries],
  );

  return (
    <AstryxCommandPalette
      isOpen
      label="Search everything"
      searchSource={source}
      input={<PaletteInput entries={entries} />}
      renderItem={renderEntry}
      emptySearchText="Nothing found."
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
      onValueChange={(id) => {
        const entry = entries.find((item) => item.id === id);
        if (entry !== undefined) void navigate(entry.to);
      }}
    />
  );
}
