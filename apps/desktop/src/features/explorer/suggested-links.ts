export interface SuggestedLink {
  /** An id from `ECOSYSTEMS`. */
  ecosystem: string;
  title: string;
  url: string;
  description: string;
}

/** The id a link has in the library: host plus path, without `www.` or a trailing slash. */
export function suggestionId(url: string): string {
  const { hostname, pathname } = new URL(url);
  return `${hostname.replace(/^www\./, "")}${pathname.replace(/\/+$/, "")}`;
}

/** Official docs and long-standing references, so Explorer is useful before anything is saved. */
export const SUGGESTED_LINKS: readonly SuggestedLink[] = [
  {
    ecosystem: "react",
    title: "React documentation",
    url: "https://react.dev/learn",
    description: "The official guide to components, state and hooks.",
  },
  {
    ecosystem: "react",
    title: "Next.js documentation",
    url: "https://nextjs.org/docs",
    description: "Routing, rendering and data fetching for React apps.",
  },
  {
    ecosystem: "react",
    title: "shadcn/ui",
    url: "https://ui.shadcn.com/",
    description: "Accessible components you copy into your own project.",
  },
  {
    ecosystem: "react",
    title: "TanStack Query",
    url: "https://tanstack.com/query/latest",
    description: "Fetching, caching and updating server data.",
  },
  {
    ecosystem: "vue",
    title: "Vue guide",
    url: "https://vuejs.org/guide/introduction.html",
    description: "The official introduction to Vue.",
  },
  {
    ecosystem: "vue",
    title: "Nuxt documentation",
    url: "https://nuxt.com/docs",
    description: "The full-stack framework built on Vue.",
  },
  {
    ecosystem: "vue",
    title: "Pinia",
    url: "https://pinia.vuejs.org/",
    description: "The official state management library for Vue.",
  },
  {
    ecosystem: "vue",
    title: "VueUse",
    url: "https://vueuse.org/",
    description: "A large collection of composition utilities.",
  },
  {
    ecosystem: "svelte",
    title: "Svelte documentation",
    url: "https://svelte.dev/docs/svelte",
    description: "The official reference for Svelte.",
  },
  {
    ecosystem: "svelte",
    title: "SvelteKit documentation",
    url: "https://svelte.dev/docs/kit",
    description: "Routing, loading and deployment for Svelte apps.",
  },
  {
    ecosystem: "svelte",
    title: "Svelte tutorial",
    url: "https://svelte.dev/tutorial",
    description: "Learn Svelte step by step in the browser.",
  },
  {
    ecosystem: "angular",
    title: "Angular documentation",
    url: "https://angular.dev/overview",
    description: "The official guides and API reference.",
  },
  {
    ecosystem: "angular",
    title: "Angular Material",
    url: "https://material.angular.dev/",
    description: "Material Design components for Angular.",
  },
  {
    ecosystem: "angular",
    title: "NgRx",
    url: "https://ngrx.io/",
    description: "Reactive state management for Angular.",
  },
  {
    ecosystem: "javascript",
    title: "MDN JavaScript",
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    description: "The standard reference for the language.",
  },
  {
    ecosystem: "javascript",
    title: "TypeScript documentation",
    url: "https://www.typescriptlang.org/docs/",
    description: "The handbook and compiler reference.",
  },
  {
    ecosystem: "javascript",
    title: "Node.js API",
    url: "https://nodejs.org/docs/latest/api/",
    description: "Every built-in Node.js module.",
  },
  {
    ecosystem: "javascript",
    title: "The Modern JavaScript Tutorial",
    url: "https://javascript.info/",
    description: "A thorough, free course from basics to advanced.",
  },
  {
    ecosystem: "css",
    title: "MDN CSS",
    url: "https://developer.mozilla.org/en-US/docs/Web/CSS",
    description: "The standard reference for CSS.",
  },
  {
    ecosystem: "css",
    title: "Tailwind CSS documentation",
    url: "https://tailwindcss.com/docs",
    description: "Every utility class, with examples.",
  },
  {
    ecosystem: "css",
    title: "CSS-Tricks",
    url: "https://css-tricks.com/",
    description: "Articles and guides, including flexbox and grid.",
  },
  {
    ecosystem: "css",
    title: "Learn CSS",
    url: "https://web.dev/learn/css",
    description: "A structured CSS course from the web.dev team.",
  },
  {
    ecosystem: "rust",
    title: "The Rust Programming Language",
    url: "https://doc.rust-lang.org/book/",
    description: "The official book, known as The Book.",
  },
  {
    ecosystem: "rust",
    title: "Rust by Example",
    url: "https://doc.rust-lang.org/rust-by-example/",
    description: "Learn the language through runnable examples.",
  },
  {
    ecosystem: "rust",
    title: "Docs.rs",
    url: "https://docs.rs/",
    description: "Documentation for every published crate.",
  },
  {
    ecosystem: "rust",
    title: "Tauri documentation",
    url: "https://v2.tauri.app/",
    description: "Build desktop and mobile apps with Rust and web UI.",
  },
  {
    ecosystem: "go",
    title: "Go documentation",
    url: "https://go.dev/doc/",
    description: "Official guides and the language specification.",
  },
  {
    ecosystem: "go",
    title: "A Tour of Go",
    url: "https://go.dev/tour/",
    description: "An interactive introduction to Go.",
  },
  {
    ecosystem: "go",
    title: "Go by Example",
    url: "https://gobyexample.com/",
    description: "Annotated example programs.",
  },
  {
    ecosystem: "go",
    title: "pkg.go.dev",
    url: "https://pkg.go.dev/",
    description: "Find and read documentation for Go packages.",
  },
  {
    ecosystem: "python",
    title: "Python documentation",
    url: "https://docs.python.org/3/",
    description: "The tutorial, language and standard library reference.",
  },
  {
    ecosystem: "python",
    title: "FastAPI",
    url: "https://fastapi.tiangolo.com/",
    description: "A modern framework for building APIs.",
  },
  {
    ecosystem: "python",
    title: "Django documentation",
    url: "https://docs.djangoproject.com/",
    description: "The full-featured web framework.",
  },
  {
    ecosystem: "python",
    title: "Python Packaging User Guide",
    url: "https://packaging.python.org/",
    description: "How to install, build and publish packages.",
  },
  {
    ecosystem: "java",
    title: "Learn Java",
    url: "https://dev.java/learn/",
    description: "Official tutorials from the Java team.",
  },
  {
    ecosystem: "java",
    title: "Kotlin documentation",
    url: "https://kotlinlang.org/docs/getting-started.html",
    description: "Get started with Kotlin and explore the language.",
  },
  {
    ecosystem: "java",
    title: "Spring Boot documentation",
    url: "https://docs.spring.io/spring-boot/",
    description: "Build production-ready Java applications.",
  },
  {
    ecosystem: "dotnet",
    title: ".NET documentation",
    url: "https://learn.microsoft.com/en-us/dotnet/",
    description: "C#, the runtime and the base libraries.",
  },
  {
    ecosystem: "dotnet",
    title: "ASP.NET Core documentation",
    url: "https://learn.microsoft.com/en-us/aspnet/core/",
    description: "Web apps and APIs on .NET.",
  },
  {
    ecosystem: "dotnet",
    title: "NuGet",
    url: "https://www.nuget.org/",
    description: "The .NET package registry.",
  },
  {
    ecosystem: "php",
    title: "PHP manual",
    url: "https://www.php.net/manual/en/",
    description: "The official language and function reference.",
  },
  {
    ecosystem: "php",
    title: "Laravel documentation",
    url: "https://laravel.com/docs",
    description: "The most popular PHP web framework.",
  },
  {
    ecosystem: "php",
    title: "PHP: The Right Way",
    url: "https://phptherightway.com/",
    description: "Current best practices in one place.",
  },
  {
    ecosystem: "ruby",
    title: "Ruby documentation",
    url: "https://docs.ruby-lang.org/en/",
    description: "The core and standard library reference.",
  },
  {
    ecosystem: "ruby",
    title: "Rails Guides",
    url: "https://guides.rubyonrails.org/",
    description: "The official guides to Ruby on Rails.",
  },
  {
    ecosystem: "ruby",
    title: "RubyGems",
    url: "https://rubygems.org/",
    description: "The Ruby package registry.",
  },
  {
    ecosystem: "mobile",
    title: "Flutter documentation",
    url: "https://docs.flutter.dev/",
    description: "Build apps for phones and desktop from one codebase.",
  },
  {
    ecosystem: "mobile",
    title: "Android developers",
    url: "https://developer.android.com/develop",
    description: "Official guides for building Android apps.",
  },
  {
    ecosystem: "mobile",
    title: "SwiftUI",
    url: "https://developer.apple.com/documentation/swiftui",
    description: "Apple's framework for building app interfaces.",
  },
  {
    ecosystem: "mobile",
    title: "React Native",
    url: "https://reactnative.dev/docs/getting-started",
    description: "Native apps written with React.",
  },
  {
    ecosystem: "databases",
    title: "PostgreSQL documentation",
    url: "https://www.postgresql.org/docs/current/",
    description: "The complete manual for the current release.",
  },
  {
    ecosystem: "databases",
    title: "SQLite documentation",
    url: "https://www.sqlite.org/docs.html",
    description: "How SQLite works and how to use it.",
  },
  {
    ecosystem: "databases",
    title: "Redis documentation",
    url: "https://redis.io/docs/latest/",
    description: "Commands, data types and guides.",
  },
  {
    ecosystem: "databases",
    title: "Use The Index, Luke",
    url: "https://use-the-index-luke.com/",
    description: "SQL indexing and tuning, explained for developers.",
  },
  {
    ecosystem: "devops",
    title: "Docker documentation",
    url: "https://docs.docker.com/",
    description: "Build, share and run containers.",
  },
  {
    ecosystem: "devops",
    title: "Kubernetes documentation",
    url: "https://kubernetes.io/docs/home/",
    description: "Concepts, tasks and reference.",
  },
  {
    ecosystem: "devops",
    title: "Terraform documentation",
    url: "https://developer.hashicorp.com/terraform/docs",
    description: "Manage infrastructure as code.",
  },
  {
    ecosystem: "ai",
    title: "Claude documentation",
    url: "https://platform.claude.com/docs",
    description: "Build with Anthropic's Claude models.",
  },
  {
    ecosystem: "ai",
    title: "OpenAI API documentation",
    url: "https://developers.openai.com/api/docs",
    description: "Guides and reference for the OpenAI API.",
  },
  {
    ecosystem: "ai",
    title: "Hugging Face documentation",
    url: "https://huggingface.co/docs",
    description: "Open models, datasets and libraries.",
  },
  {
    ecosystem: "ai",
    title: "Ollama",
    url: "https://ollama.com/",
    description: "Run open models on your own computer.",
  },
  {
    ecosystem: "ai",
    title: "Model Context Protocol",
    url: "https://modelcontextprotocol.io/",
    description: "An open standard for connecting AI apps to tools.",
  },
];
