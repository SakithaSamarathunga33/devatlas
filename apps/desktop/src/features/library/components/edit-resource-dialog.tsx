import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { CheckboxList, CheckboxListItem } from "@astryxdesign/core/CheckboxList";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Modal } from "@/components/shared/modal";
import { groupsQueryKey, useGroups } from "@/hooks/use-groups";
import { libraryQueryKey } from "@/hooks/use-library";
import { CATEGORY_META, STATUS_LABELS } from "@/lib/resource-categories";
import { describeError } from "@/services/ipc";
import { updateResource } from "@/services/organizer.service";
import { readingStatuses, resourceCategories, type Resource } from "@/types/library.types";
import type { Group } from "@/types/organizer.types";

const CATEGORY_OPTIONS = [
  { value: "", label: "Automatic" },
  ...resourceCategories.map((value) => ({ value, label: CATEGORY_META[value].label })),
];
const STATUS_OPTIONS = [
  { value: "", label: "None" },
  ...readingStatuses.map((value) => ({ value, label: STATUS_LABELS[value] })),
];

/** Edits what DevAtlas adds to a link: its category, status, tags, note and collections. */
export function EditResourceDialog({
  resource,
  onClose,
}: {
  resource: Resource;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const groups = useGroups();
  const [category, setCategory] = useState<string>(resource.categoryOverride ?? "");
  const [status, setStatus] = useState<string>(resource.status ?? "");
  const [tags, setTags] = useState(resource.tags.join(", "));
  const [note, setNote] = useState(resource.note ?? "");
  // Only what the user toggled; the rest comes from the loaded groups.
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});

  const isMember = (group: Group) => toggled[group.id] ?? group.resourceIds.includes(resource.id);

  const save = useMutation({
    mutationFn: () =>
      updateResource(resource.id, {
        category: resourceCategories.find((value) => value === category) ?? null,
        status: readingStatuses.find((value) => value === status) ?? null,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== ""),
        note: note.trim() === "" ? null : note,
        groupIds: (groups.data ?? []).filter(isMember).map((group) => group.id),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: libraryQueryKey }),
        queryClient.invalidateQueries({ queryKey: groupsQueryKey }),
      ]);
      onClose();
    },
  });

  // Saving replaces the link's groups, so it must wait until they are known.
  const canSave = groups.isSuccess && !save.isPending;

  return (
    <Modal purpose="form" title="Edit link" onClose={onClose}>
      <VStack gap={4}>
        <Text type="supporting" maxLines={1}>
          {resource.title}
        </Text>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            // Astryx's Save stays enabled for the browser (aria-disabled), so check here too.
            if (canSave) save.mutate();
          }}
        >
          <VStack gap={4}>
            <Selector
              label="Category"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
              width="100%"
            />
            <Selector
              label="Status"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
              width="100%"
            />
            <TextInput
              label="Tags"
              description="Separate with commas."
              placeholder="react, charts, client"
              value={tags}
              onChange={setTags}
            />
            <TextArea
              label="Why it's here"
              description="What you'd use it for, or what you chose it over. Your AI agent reads this."
              placeholder="Chose this over GSAP: smaller, and works with React 19."
              rows={3}
              value={note}
              onChange={setNote}
            />

            {groups.isError && (
              <Banner role="alert" status="error" title="Collections couldn't be loaded." />
            )}
            {groups.isSuccess && (
              <CheckboxList
                label="Collections"
                description={
                  groups.data.length === 0
                    ? "None yet. Create one on the Collections page."
                    : undefined
                }
                density="compact"
                value={groups.data.filter(isMember).map((group) => group.id)}
                onChange={(ids) => {
                  setToggled(
                    Object.fromEntries(
                      groups.data.map((group) => [group.id, ids.includes(group.id)]),
                    ),
                  );
                }}
              >
                {groups.data.map((group) => (
                  <CheckboxListItem key={group.id} value={group.id} label={group.name} />
                ))}
              </CheckboxList>
            )}

            {save.isError && (
              <Banner
                role="alert"
                status="error"
                title="Couldn't save the link"
                description={describeError(save.error).replace(/^.*?failed: /, "")}
              />
            )}
            <HStack gap={2} hAlign="end">
              <Button variant="ghost" label="Cancel" onClick={onClose} />
              <Button type="submit" variant="primary" label="Save" isDisabled={!canSave} />
            </HStack>
          </VStack>
        </form>
      </VStack>
    </Modal>
  );
}
