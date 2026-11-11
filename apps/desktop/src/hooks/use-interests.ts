import { useLibrary } from "@/hooks/use-library";
import { ECOSYSTEMS, ecosystemsOf } from "@/lib/ecosystems";
import { buildInterests } from "@/lib/interests";

/** What the user cares about, from local data only: nothing is sent anywhere. */
export function useInterests(): string[] {
  const library = useLibrary();
  const resources = library.data?.resources ?? [];
  const found = new Set(resources.flatMap(ecosystemsOf));
  const ecosystems = ECOSYSTEMS.filter(({ id }) => found.has(id)).flatMap(({ label, keywords }) => [
    label,
    ...keywords,
  ]);
  return buildInterests(
    resources.flatMap((resource) => resource.tags),
    ecosystems,
  );
}
