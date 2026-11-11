import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  groupSchema,
  groupsSchema,
  type Group,
  type GroupKind,
  type ResourceEdit,
} from "@/types/organizer.types";

/** Saves a link's category, tags, note and groups. */
export function updateResource(id: string, edit: ResourceEdit): Promise<null> {
  return invokeCommand("update_resource", z.null(), { id, edit });
}

/** Every collection and project. */
export function listGroups(): Promise<Group[]> {
  return invokeCommand("list_groups", groupsSchema);
}

export function createGroup(
  kind: GroupKind,
  name: string,
  description: string | null,
): Promise<Group> {
  return invokeCommand("create_group", groupSchema, { kind, name, description });
}

export function updateGroup(
  id: string,
  name: string,
  description: string | null,
): Promise<boolean> {
  return invokeCommand("update_group", z.boolean(), { id, name, description });
}

/** Deletes a group; its links stay in the library. */
export function deleteGroup(id: string): Promise<boolean> {
  return invokeCommand("delete_group", z.boolean(), { id });
}

export function setGroupResources(id: string, resourceIds: string[]): Promise<boolean> {
  return invokeCommand("set_group_resources", z.boolean(), { id, resourceIds });
}
