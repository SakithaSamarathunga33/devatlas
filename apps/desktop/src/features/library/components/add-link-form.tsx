import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link2, LoaderCircle, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
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
      className="mt-3 max-w-3xl"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block flex-1">
          <span className="sr-only">Link to save</span>
          <Link2
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            {...form.register("url")}
            type="url"
            inputMode="url"
            autoFocus={autoFocus}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a link, e.g. https://www.awwwards.com/websites/portfolio/"
            aria-invalid={message !== undefined}
            aria-describedby={message === undefined ? undefined : "add-link-error"}
            disabled={save.isPending}
            className="h-11 w-full rounded-xl border border-input bg-card pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-60 aria-invalid:border-destructive/60"
          />
        </label>
        <Button type="submit" disabled={save.isPending} className="h-11 rounded-xl px-5">
          {save.isPending ? (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <Plus aria-hidden />
          )}
          {save.isPending ? "Fetching details" : "Save link"}
        </Button>
      </div>
      {message !== undefined && (
        <p id="add-link-error" role="alert" className="mt-2 pl-4 text-xs text-destructive">
          {message}
        </p>
      )}
    </form>
  );
}
