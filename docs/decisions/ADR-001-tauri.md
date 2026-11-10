# ADR-001: Tauri 2 and Rust for the desktop application

- **Status:** Accepted
- **Date:** 2026-11-10
- **Milestone:** DEVATLAS-001

## Context

DevAtlas is a personal, daily-use desktop tool that will store a growing local library, extract
metadata from URLs, run full-text search, and later talk to a browser extension and optional AI
providers. It must start fast, use little memory, run first on Windows (with Linux and macOS
possible later), and keep a strong security boundary around file-system and network access.

## Options considered

1. **Electron + Node.js** — mature ecosystem, but bundles Chromium and Node per app (large
   installers, high memory), and privileged Node code shares a language and runtime with the UI,
   which makes the trust boundary easier to blur.
2. **Native UI (WinUI / Qt / Rust GUI toolkits)** — small and fast, but slower to build a polished,
   design-heavy UI, and the team's UI skills and component ecosystem are web-based.
3. **Tauri 2 + Rust backend + React frontend** — uses the OS webview (WebView2 on Windows), a Rust
   core for privileged work, and a capability-based permission system for IPC.

## Decision

Use **Tauri 2** with a **Rust** backend and a **React + TypeScript** frontend.

## Consequences

**Positive**

- Small installers and low memory use compared with Electron.
- Rust gives memory safety, strong typing, and excellent libraries for the planned work (SQLx,
  HTTP, HTML parsing, search).
- Tauri 2's capabilities/permissions let us grant each window only the commands it needs.
- The web frontend allows a polished UI with shadcn/ui, Tailwind, and Motion.
- A clean Rust workspace (domain/application/storage) keeps business logic testable without Tauri.

**Negative / risks**

- Rendering differences between webviews (WebView2, WebKitGTK, WKWebView) when other platforms
  are added; mitigated by Windows-first focus and testing per platform later.
- Two languages and toolchains (Rust + TypeScript); mitigated by a typed, validated IPC contract and
  documented conventions ([AGENTS.md](../../AGENTS.md)).
- Longer Rust compile times; mitigated by CI caching.
- Windows builds require the MSVC toolchain and WebView2.
