import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Link } from "@astryxdesign/core/Link";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, ListChecks, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";

import { Modal } from "@/components/shared/modal";
import { PageHeader } from "@/components/shared/page-header";
import { ResourceCard } from "@/features/library";
import { groupsQueryKey, useGroups } from "@/hooks/use-groups";
import { useLibrary } from "@/hooks/use-library";
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

const CARD_GRID = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-3";

function errorMessage(error: unknown): string {
  return describeError(error).replace(/^.*?failed: /, "");
}

function LoadFailed({ error }: { error: unknown }) {
  return <Banner role="alert" status="error" title={errorMessage(error)} />;
}

function ListSkeleton() {
  return (
    <VStack role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className={CARD_GRID}>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} index={index} height={96} />
        ))}
      </div>
    </VStack>
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
    <VStack gap={5} padding={6}>
      <PageHeader title={title} description={description}>
        <Button
          variant="primary"
          label={`New ${singular}`}
          icon={<Icon icon={Plus} />}
          onClick={() => {
            setCreating(true);
          }}
        />
      </PageHeader>

      {(groups.isPending || library.isPending) && <ListSkeleton />}
      {groups.isError && <LoadFailed error={groups.error} />}
      {groups.isSuccess && libraryFailed && <LoadFailed error={library.error} />}
      {groups.isSuccess && !library.isPending && !libraryFailed && ofKind.length === 0 && (
        <EmptyState
          headingLevel={2}
          icon={<Icon icon={ListChecks} />}
          title={`No ${title.toLowerCase()} yet`}
          description="Create one, then add links to it here or from a link's Edit button in the Library."
        />
      )}
      {groups.isSuccess && !library.isPending && !libraryFailed && ofKind.length > 0 && (
        <ul className={CARD_GRID}>
          {ofKind.map((group) => {
            const count = group.resourceIds.filter((id) => inLibrary.has(id)).length;
            const links = `${String(count)} ${count === 1 ? "link" : "links"}`;
            return (
              <li key={group.id}>
                <ClickableCard
                  href={`${path}/${encodeURIComponent(group.id)}`}
                  label={[group.name, group.description, links]
                    .filter((part) => part !== null)
                    .join(", ")}
                  height="100%"
                >
                  <VStack gap={3} height="100%" justify="between">
                    <VStack gap={1}>
                      <Heading level={5} accessibilityLevel={2} maxLines={1}>
                        {group.name}
                      </Heading>
                      {group.description !== null && (
                        <Text type="supporting" maxLines={2}>
                          {group.description}
                        </Text>
                      )}
                    </VStack>
                    <Text type="supporting" hasTabularNumbers>
                      {links}
                    </Text>
                  </VStack>
                </ClickableCard>
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
    </VStack>
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
    <Link href={path} label={`Back to ${title}`} type="supporting" color="secondary">
      <span className="inline-flex items-center gap-1.5">
        <Icon icon={ArrowLeft} size="sm" />
        {title}
      </span>
    </Link>
  );

  if (groups.isPending || library.isPending) {
    return (
      <VStack gap={4} padding={6}>
        {back}
        <ListSkeleton />
      </VStack>
    );
  }
  if (groups.isError || (library.isError && library.data === undefined)) {
    return (
      <VStack gap={4} padding={6}>
        {back}
        <LoadFailed error={groups.error ?? library.error} />
      </VStack>
    );
  }
  const group = groups.data.find((item) => item.id === groupId);
  if (group === undefined) {
    return (
      <VStack gap={4} padding={6}>
        {back}
        <EmptyState headingLevel={1} title={`This ${singular} no longer exists.`} />
      </VStack>
    );
  }

  const resources = library.data.resources;
  const members = resources.filter((resource) => group.resourceIds.includes(resource.id));

  return (
    <VStack gap={4} padding={6}>
      {back}
      <PageHeader
        title={group.name}
        description={group.description ?? `${String(members.length)} links`}
      >
        <HStack gap={2} vAlign="center">
          <Button
            variant="primary"
            label="Manage links"
            icon={<Icon icon={ListChecks} />}
            onClick={() => {
              setDialog("links");
            }}
          />
          <IconButton
            variant="ghost"
            label={`Edit ${singular}`}
            tooltip={`Edit ${singular}`}
            icon={<Icon icon={Pencil} />}
            onClick={() => {
              setDialog("edit");
            }}
          />
          <IconButton
            variant="ghost"
            label={`Delete ${singular}`}
            tooltip={`Delete ${singular}`}
            icon={<Icon icon={Trash2} />}
            onClick={() => {
              setDialog("delete");
            }}
          />
        </HStack>
      </PageHeader>
      {members.length === 0 ? (
        <EmptyState
          headingLevel={2}
          icon={<Icon icon={Link2} />}
          title={`No links in this ${singular} yet`}
          description="Use Manage links to add some."
        />
      ) : (
        <ul className={CARD_GRID}>
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
    </VStack>
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
  const isNameEmpty = name.trim() === "";

  return (
    <Modal
      purpose="form"
      title={group === undefined ? `New ${singular}` : `Edit ${singular}`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          // Astryx's submit button is only aria-disabled, so Enter still reaches this handler.
          if (!isNameEmpty && !save.isPending) save.mutate();
        }}
      >
        <VStack gap={4}>
          <TextInput label="Name" value={name} hasAutoFocus onChange={setName} />
          <TextArea label="Description" value={description} rows={2} onChange={setDescription} />
          {save.isError && <Banner role="alert" status="error" title={errorMessage(save.error)} />}
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Cancel" onClick={onClose} />
            <Button
              type="submit"
              variant="primary"
              label={group === undefined ? "Create" : "Save"}
              isLoading={save.isPending}
              isDisabled={isNameEmpty}
            />
          </HStack>
        </VStack>
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
    <Modal purpose="form" title="Manage links" onClose={onClose}>
      <VStack gap={3}>
        <TextInput
          type="search"
          label="Filter links"
          isLabelHidden
          placeholder="Filter links…"
          startIcon={Search}
          value={filter}
          onChange={setFilter}
        />
        {resources.length === 0 && <EmptyState isCompact title="Your library is empty." />}
        {resources.length > 0 && visible.length === 0 && (
          <EmptyState isCompact title="No links match this filter." />
        )}
        {visible.length > 0 && (
          <VStack gap={2} className="max-h-80 overflow-y-auto">
            {visible.map((resource) => (
              <CheckboxInput
                key={resource.id}
                label={resource.title}
                description={resource.host}
                value={selected.has(resource.id)}
                onChange={(checked) => {
                  toggle(resource.id, checked);
                }}
              />
            ))}
          </VStack>
        )}
        {save.isError && <Banner role="alert" status="error" title={errorMessage(save.error)} />}
        <HStack gap={2} hAlign="end">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="primary"
            label="Save"
            isLoading={save.isPending}
            onClick={() => {
              save.mutate();
            }}
          />
        </HStack>
      </VStack>
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
      <VStack gap={4}>
        <Text type="supporting" as="p">
          This can&apos;t be undone. The links stay in your library.
        </Text>
        {remove.isError && (
          <Banner role="alert" status="error" title={errorMessage(remove.error)} />
        )}
        <HStack gap={2} hAlign="end">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="destructive"
            label="Delete"
            isLoading={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          />
        </HStack>
      </VStack>
    </Modal>
  );
}
