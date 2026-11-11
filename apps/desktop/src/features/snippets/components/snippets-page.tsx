import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Selector } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { StackItem } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";
import { useLibrary } from "@/hooks/use-library";
import { snippetsQueryKey, useSnippets } from "@/hooks/use-snippets";
import { describeError } from "@/services/ipc";
import { createSnippet, deleteSnippet, updateSnippet } from "@/services/snippets.service";
import type { Snippet } from "@/types/snippets.types";

/** TextArea reads the body font token, so pointing that token at the code font makes it mono. */
const CODE_FONT = { "--font-family-body": "var(--font-family-code)" } as CSSProperties;

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
    <VStack padding={6}>
      <PageHeader title="Snippets" description="Small pieces of code worth keeping.">
        <div className="flex max-w-xl min-w-0 flex-1 basis-80 items-center justify-end gap-2">
          <SearchField
            value={search}
            onChange={(value) => {
              setParams(value === "" ? {} : { q: value }, { replace: true });
            }}
            label="Search snippets"
            placeholder="Search…"
          />
          <Button
            label="New snippet"
            variant="primary"
            icon={<Icon icon={Plus} />}
            onClick={() => {
              setCreating(true);
            }}
          />
        </div>
      </PageHeader>

      {snippets.isPending && (
        <div role="status" aria-busy="true" className="mt-5 grid gap-3 lg:grid-cols-2">
          <VisuallyHidden>Loading snippets</VisuallyHidden>
          <Skeleton height={160} />
          <Skeleton height={160} index={1} />
        </div>
      )}
      {snippets.isError && (
        <div className="mt-8">
          <Banner status="error" role="alert" title={message(snippets.error)} />
        </div>
      )}
      {snippets.isSuccess && all.length === 0 && (
        <EmptyState title="No snippets yet" description="Save the few lines you always look up." />
      )}
      {snippets.isSuccess && all.length > 0 && visible.length === 0 && (
        <EmptyState title={`No snippets match “${search}”`} />
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
    </VStack>
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
    <article className="h-full">
      <Card height="100%">
        <VStack gap={3}>
          <HStack gap={2} vAlign="start">
            <StackItem size="fill">
              <VStack gap={1}>
                <Heading level={5} accessibilityLevel={2} maxLines={1}>
                  {snippet.title}
                </Heading>
                <HStack gap={1.5} vAlign="center" wrap="wrap">
                  {snippet.language !== null && <Text type="supporting">{snippet.language}</Text>}
                  {snippet.tags.map((tag) => (
                    <Token key={tag} label={tag} size="sm" />
                  ))}
                  {attached !== undefined && (
                    <Token label={attached} size="sm" color="blue" icon={<Icon icon={Link2} />} />
                  )}
                </HStack>
              </VStack>
            </StackItem>
            <IconButton
              label={`Copy ${snippet.title}`}
              tooltip="Copy"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Copy} />}
              onClick={copy}
            />
            <IconButton
              label={`Edit ${snippet.title}`}
              tooltip="Edit"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Pencil} />}
              onClick={() => {
                setDialog("edit");
              }}
            />
            <IconButton
              label={`Delete ${snippet.title}`}
              tooltip="Delete"
              variant="ghost"
              size="sm"
              icon={<Icon icon={Trash2} />}
              onClick={() => {
                setDialog("delete");
              }}
            />
          </HStack>
          <CodeBlock
            code={snippet.code}
            language={snippet.language?.toLowerCase() ?? "plaintext"}
            hasLanguageLabel={false}
            hasCopyButton={false}
            size="sm"
            width="100%"
            maxHeight={256}
          />
        </VStack>
      </Card>
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
    <Modal
      purpose="form"
      title={snippet === undefined ? "New snippet" : "Edit snippet"}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <VStack gap={4}>
          <FormLayout>
            <TextInput label="Title" hasAutoFocus value={title} onChange={setTitle} />
            <TextInput
              label="Language"
              placeholder="TypeScript"
              value={language}
              onChange={setLanguage}
            />
            <TextArea
              label="Code"
              rows={8}
              hasSpellCheck={false}
              controlStyle={CODE_FONT}
              value={code}
              onChange={setCode}
            />
            <TextInput label="Tags" placeholder="react, hooks" value={tags} onChange={setTags} />
            <Selector
              label="Link"
              hasSearch
              options={[
                { value: "", label: "None" },
                ...(library.data?.resources ?? []).map((resource) => ({
                  value: resource.id,
                  label: resource.title,
                })),
              ]}
              value={resourceId}
              onChange={setResourceId}
            />
          </FormLayout>
          {save.isError && <Banner status="error" role="alert" title={message(save.error)} />}
          <HStack gap={2} hAlign="end">
            <Button label="Cancel" variant="ghost" onClick={onClose} />
            <Button
              type="submit"
              label={snippet === undefined ? "Create" : "Save"}
              variant="primary"
              isDisabled={save.isPending || title.trim() === "" || code.trim() === ""}
            />
          </HStack>
        </VStack>
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
      <VStack gap={4}>
        <Text type="supporting" as="p">
          This can&apos;t be undone.
        </Text>
        {remove.isError && <Banner status="error" role="alert" title={message(remove.error)} />}
        <HStack gap={2} hAlign="end">
          <Button label="Cancel" variant="ghost" onClick={onClose} />
          <Button
            label="Delete"
            variant="destructive"
            isDisabled={remove.isPending}
            onClick={() => {
              remove.mutate();
            }}
          />
        </HStack>
      </VStack>
    </Modal>
  );
}
