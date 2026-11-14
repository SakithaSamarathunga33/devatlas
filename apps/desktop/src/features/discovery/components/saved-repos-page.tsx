import { VStack } from "@astryxdesign/core/VStack";
import { useSearchParams } from "react-router";

import { PageHeader } from "@/components/shared/page-header";
import { SearchField } from "@/components/shared/search-field";

import { SavedRepos } from "./saved-repos";

/** The GitHub repositories saved in the library, on their own page under Library. The search
 * lives in the URL (`?q=agent`), as on the Repos page. */
export function SavedReposPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";

  return (
    <VStack padding={6}>
      <VStack gap={4}>
        <PageHeader
          title="Saved repos"
          description="GitHub repositories in your library, with their language and stars from GitHub."
        />
        <SearchField
          value={search}
          onChange={(value) => {
            setParams(value === "" ? {} : { q: value }, { replace: true });
          }}
          label="Search saved repositories"
          placeholder="Search repositories…"
        />
        <SavedRepos search={search} />
      </VStack>
    </VStack>
  );
}
