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

Starts empty. Each developer adds links themselves or picks a browser, profile and bookmark folder
in Settings, which DevAtlas then reads live and read-only, sorts into categories automatically, and opens sites inside the app — no import step, no account, no
cloud. Discovery, News, and Rankings sit next to the personal library so "what I have" and "what's
new" live in one place.

## Operating Context

A desktop window (Tauri 2, WebView2) used alongside an editor and a browser. Sessions start with a
"start of day" look at the dashboard: what is new (new library saves, trending repositories, top
developer news) and quick paths back into the library. Data is local; network sources are a fixed
allow-list (GitHub Search API, Hacker News, 35 official blogs, TIOBE/PYPL).

## Capabilities and Constraints

- Shipped: Library (a chosen browser's bookmark folder + links added in-app, editable categories,
  tags and notes, "New" tag for 7 days, in-app site viewer), Collections (named groups
  of links), Repos (new GitHub repos by period and language, Star History rankings, Save to
  Library, star history, Saved repos with latest release and star growth), News (Hacker News front
  page + official blogs), Languages (TIOBE and PYPL side by side), Settings (bookmark source).
- Also shipped: Ctrl K search, Snippets, Explorer, reading status, Rediscover, For you, link checker, backup and import, one-click update (checks DevAtlas's GitHub releases, installs a signed 9 MB update and restarts).
- Not built: AI features, sync. A browser extension was considered and dropped: links can be added
  in the app.
- Browsers are never written to. GitHub data is cached (15 min trending, 1 h repo details); feeds 30 min.
- Windows is the only tested platform.

## Brand Commitments

- Name: DevAtlas.
- Logo: the "D" compass mark (purple-to-blue gradient, `public/devatlas-mark.png`) stays as-is.
- Colour palette (binding, set by the owner on 2026-11-14, replacing "Slate & Mint"): "Indigo
  Aurora", light and dark, taken from the logo's indigo-to-blue gradient. Dark: background
  `#0B0B10`, surface `#15151C`, popover `#1C1C24`, border `#26262F`; accent (Apple system indigo)
  `#5E5CE6` with white labels, links and accent icons `#A9A8FF`. Light: background `#F5F5F7`,
  surfaces `#FFFFFF`, border `#E5E5EA`; accent and links `#5856D6`. Brand gradient `#6366F1` to
  `#3B82F6` (light `#5856D6` to `#2563EB`); categories stay in the indigo, blue and violet family.
- Look and feel follow Apple's materials. A still aurora glow lights the window frame behind a
  transparent title bar and sidebar, and content sits on one raised panel with a lit edge. The
  current page is tinted with the accent, large headings use tighter tracking, and springs settle
  without overshoot. Reduced transparency and higher contrast turn the glow off, and reduced
  motion shows animated elements in their final state.
  Theme in `src/themes/devatlas/devatlasTheme.ts` (copied to the installer), tokens in
  `src/styles/globals.css`.
- Design system the owner chose: Astryx (`@astryxdesign/core`), with a DevAtlas theme in `src/themes/devatlas`.

## Evidence on Hand

Real data only: the user's own bookmarks, GitHub, Hacker News, the allow-listed blogs, TIOBE/PYPL.
No users, testimonials, or usage metrics exist; never fabricate them.

## Product Principles

1. Balance "what's new" with "get back to what I saved" on every entry point.
2. Never fabricate content: every number, repo, and story shown comes from a real source.
3. Local-first and read-only toward the user's browser.
4. Planned features are labelled honestly as "Soon", never mocked.
