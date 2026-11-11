import { z } from "zod";

import { invokeCommand } from "@/services/ipc";
import {
  snippetSchema,
  snippetsSchema,
  type Snippet,
  type SnippetInput,
} from "@/types/snippets.types";

export function listSnippets(): Promise<Snippet[]> {
  return invokeCommand("list_snippets", snippetsSchema);
}

export function createSnippet(input: SnippetInput): Promise<Snippet> {
  return invokeCommand("create_snippet", snippetSchema, { input });
}

export function updateSnippet(id: string, input: SnippetInput): Promise<boolean> {
  return invokeCommand("update_snippet", z.boolean(), { id, input });
}

export function deleteSnippet(id: string): Promise<boolean> {
  return invokeCommand("delete_snippet", z.boolean(), { id });
}
