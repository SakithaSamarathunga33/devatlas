import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { groupsQueryKey, useGroups } from "@/hooks/use-groups";
import { libraryQueryKey } from "@/hooks/use-library";
import { CATEGORY_META } from "@/lib/resource-categories";
import { fieldClass, selectClass } from "@/lib/styles";
import { describeError } from "@/services/ipc";
import { updateResource } from "@/services/organizer.service";
import { resourceCategories, type Resource } from "@/types/library.types";
import type { Group, GroupKind } from "@/types/organizer.types";

const GROUP_HEADINGS: Record<GroupKind, string> = {
  collection: "Collections",
  project: "Projects",
};

/** Edits what DevAtlas adds to a link: its category, tags, note, collections and projects. */
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
  const [tags, setTags] = useState(resource.tags.join(", "));
  const [note, setNote] = useState(resource.note ?? "");
  // Only what the user toggled; the rest comes from the loaded groups.
  const [toggled, setToggled] = useState<Readonly<Record<string, boolean>>>({});

  const isMember = (group: Group) => toggled[group.id] ?? group.resourceIds.includes(resource.id);

  const save = useMutation({
    mutationFn: () =>
      updateResource(resource.id, {
        category: resourceCategories.find((value) => value === category) ?? null,
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

  return (
    <Modal title="Edit link" onClose={onClose}>
      <p className="mt-1 truncate text-sm text-muted-foreground">{resource.title}</p>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Category
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
            className={selectClass}
          >
            <option value="">Automatic</option>
            {resourceCategories.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_META[value].label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Tags
            <input
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
              }}
              placeholder="react, charts, client"
              className={fieldClass}
            />
          </label>
          <p className="text-xs text-muted-foreground">Separate with commas.</p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Note
          <textarea
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            rows={3}
            className={fieldClass}
          />
        </label>

        {groups.isError && (
          <p role="alert" className="text-sm text-destructive">
            Collections and projects couldn&apos;t be loaded.
          </p>
        )}
        {groups.isSuccess &&
          (["collection", "project"] as const).map((kind) => {
            const ofKind = groups.data.filter((group) => group.kind === kind);
            return (
              <fieldset key={kind}>
                <legend className="text-sm font-medium">{GROUP_HEADINGS[kind]}</legend>
                {ofKind.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    None yet. Create one on the {GROUP_HEADINGS[kind]} page.
                  </p>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {ofKind.map((group) => (
                      <label key={group.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={isMember(group)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setToggled((current) => ({ ...current, [group.id]: checked }));
                          }}
                          className="size-4 accent-primary"
                        />
                        {group.name}
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}

        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {describeError(save.error).replace(/^.*?failed: /, "")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {/* Saving replaces the link's groups, so it must wait until they are known. */}
          <Button type="submit" disabled={save.isPending || !groups.isSuccess}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
