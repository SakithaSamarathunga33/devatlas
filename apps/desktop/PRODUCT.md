# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Software developers who install DevAtlas on their own Windows machine (shipped through the custom
DevAtlas Setup installer). They collect a large, scattered set of developer resources — UI
component libraries, design inspiration, animation and icon sets, tools, cloud consoles, GitHub
repositories — mostly as browser bookmarks, and lose track of them. They open DevAtlas at the
start of a work session and come back to it throughout the day.

## Product Purpose

DevAtlas is a local-first desktop app that captures, organizes, and helps developers rediscover the
resources they rely on, and keeps them current on what is new in their ecosystem. Success: a
developer finds a resource they saved months ago in seconds, and notices worthwhile new repos,
news, and language trends without leaving the app.

## Positioning

Reads the developer's existing Brave bookmarks (the `develop` folder) live and read-only, sorts them
into categories automatically, and opens sites inside the app — no import step, no account, no
cloud. Discovery, News, and Rankings sit next to the personal library so "what I have" and "what's
new" live in one place.

## Operating Context

A desktop window (Tauri 2, WebView2) used alongside an editor and a browser. Sessions start with a
"start of day" look at the dashboard: what is new (new library saves, trending repositories, top
developer news) and quick paths back into the library. Data is local; network sources are a fixed
allow-list (GitHub Search API, Hacker News, 35 official blogs, TIOBE/PYPL).

## Capabilities and Constraints

- Shipped: Library (Brave `develop` bookmarks + links added in-app, categories, "New" tag for 7
  days, in-app site viewer), Discovery (GitHub repos gaining stars today/week/month, by language,
  Save to Library, star history, Saved repos), News (Hacker News front page + official blogs),
  Rankings (TIOBE and PYPL side by side).
- Planned, not built (navigation shows them as "Soon"): Collections, Explorer, Projects, Settings,
  search, browser extension, AI features, sync.
- Brave is never written to. GitHub data is cached (15 min trending, 1 h repo details); feeds 30 min.
- Windows is the only tested platform.

## Brand Commitments

- Name: DevAtlas.
- Logo: the "D" compass mark (purple-to-blue gradient, `public/devatlas-mark.png`) stays as-is.
- Colour palette (binding, set by the owner): "Slate & Mint", light and dark. Dark: background
  `#0F1115`, surface `#1E293B`, surface-alt `#0B1F1E`, border `#2D3748`, text `#F1F5F9` /
  `#94A3B8` / `#64748B`, mint `#14B8A6` (hover `#0D9488`, active `#0F766E`), teal `#2DD4BF`,
  cyan `#22D3EE`. Light: background `#F8FAFC`, surface `#FFFFFF`, surface-alt `#F1F5F9`, border
  `#E2E8F0`, text `#0F172A` / `#334155` / `#64748B`; actions use `#0F766E` and cyan text
  `#0E7490` for contrast on white. Tokens live in `src/styles/globals.css`.
- Component libraries the owner chose: Magic UI (animated circular progress), React Bits (Gooey
  Nav), Bklit (charts); Uiverse is welcome but its site can't be fetched, so pieces are pasted in.

## Evidence on Hand

Real data only: the user's own bookmarks, GitHub, Hacker News, the allow-listed blogs, TIOBE/PYPL.
No users, testimonials, or usage metrics exist; never fabricate them.

## Product Principles

1. Balance "what's new" with "get back to what I saved" on every entry point.
2. Never fabricate content: every number, repo, and story shown comes from a real source.
3. Local-first and read-only toward the user's browser.
4. Planned features are labelled honestly as "Soon", never mocked.
