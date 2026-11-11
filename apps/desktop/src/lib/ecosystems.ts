import { subMonths } from "date-fns";

import type { Resource } from "@/types/library.types";

import { interestMatcher } from "./interests";

export interface Ecosystem {
  id: string;
  label: string;
  /** Matched as whole words in a link's title, address and tags. */
  keywords: readonly string[];
}

// ponytail: a fixed keyword list; ecosystem tags on a link are the way to correct a miss.
export const ECOSYSTEMS: readonly Ecosystem[] = [
  { id: "react", label: "React", keywords: ["react", "reactjs", "next.js", "nextjs", "shadcn"] },
  { id: "vue", label: "Vue", keywords: ["vue", "vuejs", "nuxt"] },
  { id: "svelte", label: "Svelte", keywords: ["svelte", "sveltekit"] },
  { id: "angular", label: "Angular", keywords: ["angular"] },
  {
    id: "javascript",
    label: "JavaScript",
    keywords: ["javascript", "typescript", "node.js", "nodejs", "npm", "deno"],
  },
  { id: "css", label: "CSS", keywords: ["css", "tailwind", "tailwindcss", "sass"] },
  { id: "rust", label: "Rust", keywords: ["rust", "rust-lang", "crates.io", "tauri"] },
  { id: "go", label: "Go", keywords: ["golang", "go.dev"] },
  { id: "python", label: "Python", keywords: ["python", "django", "flask", "fastapi", "pypi"] },
  { id: "java", label: "Java & Kotlin", keywords: ["java", "kotlin", "spring boot"] },
  { id: "dotnet", label: ".NET", keywords: [".net", "csharp", "c#", "dotnet"] },
  { id: "php", label: "PHP", keywords: ["php", "laravel"] },
  { id: "ruby", label: "Ruby", keywords: ["ruby", "rails"] },
  {
    id: "mobile",
    label: "Mobile",
    keywords: ["flutter", "swift", "swiftui", "react native", "android", "ios"],
  },
  {
    id: "databases",
    label: "Databases",
    keywords: ["postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis"],
  },
  { id: "devops", label: "DevOps", keywords: ["docker", "kubernetes", "terraform"] },
  { id: "ai", label: "AI", keywords: ["llm", "openai", "anthropic", "claude", "gpt"] },
];

const MATCHERS = ECOSYSTEMS.map((ecosystem) => ({
  id: ecosystem.id,
  matches: interestMatcher(ecosystem.keywords),
}));

/** The ids of the ecosystems a link belongs to. A tag naming one counts too. */
export function ecosystemsOf(resource: Resource): string[] {
  const text = [resource.title, resource.host, resource.url, ...resource.tags].join(" ");
  const tags = resource.tags.map((tag) => tag.toLowerCase());
  return MATCHERS.filter(({ id, matches }) => matches(text) || tags.includes(id)).map(
    ({ id }) => id,
  );
}

const REDISCOVER_AFTER_MONTHS = 6;
const REDISCOVER_COUNT = 3;

/** Old links that haven't been opened lately and aren't in use, oldest first. */
export function rediscoverable(resources: readonly Resource[], now: number): Resource[] {
  const cutoff = subMonths(now, REDISCOVER_AFTER_MONTHS).getTime();
  return resources
    .filter(
      (resource) =>
        resource.addedAt !== null &&
        resource.addedAt < cutoff &&
        resource.status !== "using" &&
        (resource.lastOpenedAt === null || resource.lastOpenedAt < cutoff),
    )
    .sort((a, b) => (a.addedAt ?? 0) - (b.addedAt ?? 0))
    .slice(0, REDISCOVER_COUNT);
}
