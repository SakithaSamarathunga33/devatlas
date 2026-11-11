import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { TextInput } from "@astryxdesign/core/TextInput";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { libraryQueryKey } from "@/hooks/use-library";
import { describeError } from "@/services/ipc";
import { addLink } from "@/services/library.service";

const addLinkSchema = z.object({
  url: z.string().trim().min(1, "Paste a link to save it."),
});
type AddLinkValues = z.infer<typeof addLinkSchema>;

/** Saves a pasted link in DevAtlas; the card appears with its preview and a New tag. */
export function AddLinkForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const queryClient = useQueryClient();
  const form = useForm<AddLinkValues>({
    resolver: zodResolver(addLinkSchema),
    defaultValues: { url: "" },
  });
  const save = useMutation({
    mutationFn: (values: AddLinkValues) => addLink(values.url),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: libraryQueryKey });
    },
    onError: (error) => {
      // Show the backend's own explanation without the IPC prefix.
      form.setError("url", { message: describeError(error).replace(/^.*?failed: /, "") });
    },
  });

  const message = form.formState.errors.url?.message;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void form.handleSubmit((values) => {
          save.mutate(values);
        })(event);
      }}
      className="flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-start"
    >
      <div className="min-w-0 flex-1">
        <Controller
          control={form.control}
          name="url"
          render={({ field }) => (
            <TextInput
              ref={field.ref}
              type="url"
              label="Link to save"
              isLabelHidden
              inputMode="url"
              startIcon={Link2}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              hasAutoFocus={autoFocus}
              autoComplete="off"
              hasSpellCheck={false}
              placeholder="Paste a link, e.g. https://www.awwwards.com/websites/portfolio/"
              isDisabled={save.isPending}
              status={message === undefined ? undefined : { type: "error", message }}
              statusVariant="detached"
            />
          )}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        icon={<Icon icon={Plus} />}
        isLoading={save.isPending}
        label={save.isPending ? "Fetching details" : "Save link"}
      />
    </form>
  );
}
