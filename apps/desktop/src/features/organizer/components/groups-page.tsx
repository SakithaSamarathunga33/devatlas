import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleAlert, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { Modal } from "@/components/shared/modal";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceCard } from "@/features/library";
import { groupsQueryKey, useGroups } from "@/hooks/use-groups";
import { useLibrary } from "@/hooks/use-library";
import { fieldClass } from "@/lib/styles";
import { describeError } from "@/services/ipc";
import {
  createGroup,
  deleteGroup,
  setGroupResources,
  updateGroup,
} from "@/services/organizer.service";
import type { Resource } from "@/types/library.types";
import type { Group } from "@/types/organizer.types";

const COPY = {
  title: "Collections",
  singular: "collection",
  path: "/collections",
  description: "Group links into curated sets for a stack, a client, or an idea.",
};

const PAGE = "w-full px-5 pt-5 pb-16 lg:px-8";

function errorMessage(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

function LoadFailed({ error }: { error: unknown }) {
  return (
    <p role="alert" className="mt-8 flex items-center gap-2 text-sm text-destructive">
      <CircleAlert className="size-4 shrink-0" aria-hidden />
      {errorMessage(error)}
    </p>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">Loading</span>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export function CollectionsPage() {
  const { title, singular, path, description } = COPY;
  const groups = useGroups();
  const library = useLibrary();
  const [creating, setCreating] = useState(false);
  // Without the library every count would read 0; a later failed poll keeps the last data.
  const libraryFailed = library.isError && library.data === undefined;
  const inLibrary = new Set(library.data?.resources.map((resource) => resource.id));
  const ofKind = groups.data ?? [];

  return (
    <div className={PAGE}>
      <PageHeader title={title} description={description}>
        <Button
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus aria-hidden />
          New {singular}
        </Button>
      </PageHeader>

      {(groups.isPending || library.isPending) && <ListSkeleton />}
      {groups.isError && <LoadFailed error={groups.error} />}
      {groups.isSuccess && libraryFailed && <LoadFailed error={library.error} />}
      {groups.isSuccess && !library.isPending && !libraryFailed && ofKind.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No {title.toLowerCase()} yet. Create one, then add links to it here or from a link&apos;s
          Edit button in the Library.
        </p>
      )}
      {groups.isSuccess && !library.isPending && !libraryFailed && ofKind.length > 0 && (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {ofKind.map((group) => {
            const count = group.resourceIds.filter((id) => inLibrary.has(id)).length;
            return (
              <li key={group.id}>
                <Link
                  to={`${path}/${encodeURIComponent(group.id)}`}
                  className="flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-[border-color] outline-none hover:border-foreground/15 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="truncate text-sm font-semibold">{group.name}</span>
                  {group.description !== null && (
                    <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {group.description}
                    </span>
                  )}
                  <span className="mt-3 text-xs text-muted-foreground tabular-nums">
                    {count} {count === 1 ? "link" : "links"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <GroupFormDialog
          onClose={() => {
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

type Dialog = "links" | "edit" | "delete" | null;

export function CollectionDetailPage() {
  const { title, singular, path } = COPY;
  const { groupId } = useParams();
  const groups = useGroups();
  const library = useLibrary();
  const [dialog, setDialog] = useState<Dialog>(null);
  const closeDialog = () => {
    setDialog(null);
  };

  const back = (
    <Link
      to={path}
      aria-label={`Back to ${title}`}
      className="mb-3 inline-flex items-center gap-1.5 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {title}
    </Link>
  );

  if (groups.isPending || library.isPending) {
    return (
      <div className={PAGE}>
        {back}
        <ListSkeleton />
      </div>
    );
  }
  if (groups.isError || (library.isError && library.data === undefined)) {
    return (
      <div className={PAGE}>
        {back}
        <LoadFailed error={groups.error ?? library.error} />
      </div>
    );
  }
  const group = groups.data.find((item) => item.id === groupId);
  if (group === undefined) {
    return (
      <div className={PAGE}>
        {back}
        <p className="mt-4 text-sm text-muted-foreground">This {singular} no longer exists.</p>
      </div>
    );
  }

  const resources = library.data.resources;
  const members = resources.filter((resource) => group.resourceIds.includes(resource.id));

  return (
    <div className={PAGE}>
      {back}
      <PageHeader
        title={group.name}
        description={group.description ?? `${String(members.length)} links`}
      >
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setDialog("links");
            }}
          >
            <ListChecks aria-hidden />
            Manage links
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${singular}`}
            title={`Edit ${singular}`}
            onClick={() => {
              setDialog("edit");
            }}
          >
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${singular}`}
            title={`Delete ${singular}`}
            onClick={() => {
              setDialog("delete");
            }}
            className="hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </PageHeader>
      {members.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          No links in this {singular} yet. Use Manage links to add some.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3">
          {members.map((resource) => (
            <li key={resource.id}>
              <ResourceCard resource={resource} />
            </li>
          ))}
        </ul>
      )}

      {dialog === "links" && (
        <ManageLinksDialog group={group} resources={resources} onClose={closeDialog} />
      )}
      {dialog === "edit" && <GroupFormDialog group={group} onClose={closeDialog} />}
      {dialog === "delete" && <DeleteDialog group={group} onClose={closeDialog} />}
    </div>
  );
}

/** Creates a group, or edits one when `group` is given. */
function GroupFormDialog({ group, onClose }: { group?: Group; onClose: () => void }) {
  const { singular } = COPY;
  const queryClient = useQueryClient();
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const text = description.trim() === "" ? null : description;
      if (group === undefined) await createGroup(name, text);
      else await updateGroup(group.id, name, text);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupsQueryKey });
      onClose();
    },
  });

  return (
    <Modal title={group === undefined ? `New ${singular}` : `Edit ${singular}`} onClose={onClose}>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Name
          <input
            value={name}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Description
          <textarea
            value={description}
            rows={2}
            onChange={(event) => {
              setDescription(event.target.value);
            }}
            className={fieldClass}
          />
        </label>
        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || name.trim() === ""}>
            {group === undefined ? "Create" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Ticks links in or out of a group. Links hidden from the library keep their membership. */
function ManageLinksDialog({
  group,
  resources,
  onClose,
}: {
  group: Group;
  resources: readonly Resource[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set(group.resourceIds));
  const [filter, setFilter] = useState("");
  const term = filter.trim().toLowerCase();
  const visible = resources.filter(
    (resource) =>
      term === "" ||
      resource.title.toLowerCase().includes(term) ||
      resource.host.toLowerCase().includes(term),
  );
  const save = useMutation({
    mutationFn: () => setGroupResources(group.id, [...selected]),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: groupsQueryKey });
      onClose();
    },
  });
  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <Modal title="Manage links" onClose={onClose}>
      <input
        type="search"
        aria-label="Filter links"
        placeholder="Filter links…"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
        }}
        className={`mt-4 ${fieldClass}`}
      />
      {resources.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Your library is empty.</p>
      ) : (
        <div className="mt-3 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
          {visible.map((resource) => (
            <label
              key={resource.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary"
            >
              <input
                type="checkbox"
                aria-label={resource.title}
                checked={selected.has(resource.id)}
                onChange={(event) => {
                  toggle(resource.id, event.target.checked);
                }}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{resource.title}</span>
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {resource.host}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      {save.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={save.isPending}
          onClick={() => {
            save.mutate();
          }}
        >
          Save
        </Button>
      </div>
    </Modal>
  );
}

function DeleteDialog({ group, onClose }: { group: Group; onClose: () => void }) {
  const { path } = COPY;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => deleteGroup(group.id),
    onSuccess: () => {
      // Updated in the same tick as the navigation, so the list never shows it again.
      queryClient.setQueryData<Group[]>(groupsQueryKey, (current) =>
        current?.filter((item) => item.id !== group.id),
      );
      void navigate(path);
    },
  });

  return (
    <Modal title={`Delete “${group.name}”?`} onClose={onClose}>
      <p className="mt-2 text-sm text-muted-foreground">
        This can&apos;t be undone. The links stay in your library.
      </p>
      {remove.isError && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {errorMessage(remove.error)}
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
