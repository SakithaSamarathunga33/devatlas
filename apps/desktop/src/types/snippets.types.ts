import { z } from "zod";

/** Mirrors `devatlas_application::snippets::Snippet`. */
export const snippetSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  language: z.string().nullable(),
  code: z.string(),
  tags: z.array(z.string()),
  resourceId: z.string().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Snippet = z.infer<typeof snippetSchema>;

export const snippetsSchema = z.array(snippetSchema);

/** Mirrors `devatlas_application::snippets::SnippetInput`. */
export type SnippetInput = Pick<Snippet, "title" | "language" | "code" | "tags" | "resourceId">;
