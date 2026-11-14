/**
 * The E2E `test`: each test gets a fresh `FakeBackend` behind Tauri's IPC boundary and a page
 * that can reach nothing but the Vite dev server. Call `launch()` with the scenario's changes,
 * then drive the real UI.
 */
import { test as base, expect } from "@playwright/test";

import { defaultScenario, FakeBackend, type Scenario } from "./fake-backend";

type InvokeResult = { ok: unknown } | { error: string };

interface Fixtures {
  /** Opens DevAtlas at `path` against a backend in the given state. */
  launch: (scenario?: Partial<Scenario>, path?: string) => Promise<FakeBackend>;
}

export const test = base.extend<Fixtures>({
  launch: async ({ page, context }, use) => {
    // No real network: GitHub avatars, Supabase and everything else off localhost fail fast.
    await context.route(
      (url) => url.hostname !== "localhost" && url.hostname !== "127.0.0.1",
      (route) => route.abort("blockedbyclient"),
    );
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const backends: FakeBackend[] = [];
    await use(async (scenario = {}, path = "/") => {
      const fake = new FakeBackend({ ...defaultScenario(), ...scenario });
      backends.push(fake);
      await page.exposeFunction(
        "__devatlasE2eInvoke",
        async (command: string, args: Record<string, unknown>): Promise<InvokeResult> => {
          try {
            return { ok: await fake.handle(command, args) };
          } catch (cause) {
            return { error: cause instanceof Error ? cause.message : String(cause) };
          }
        },
      );
      // What Tauri injects into its webview: `isTauri` and the IPC entry point `invoke()` uses.
      await page.addInitScript(() => {
        const bridge = window as unknown as {
          isTauri: boolean;
          __TAURI_INTERNALS__: unknown;
          __devatlasE2eInvoke: (command: string, args: unknown) => Promise<InvokeResult>;
        };
        bridge.isTauri = true;
        bridge.__TAURI_INTERNALS__ = {
          invoke: async (command: string, args: unknown) => {
            const result = await bridge.__devatlasE2eInvoke(command, args ?? {});
            // Tauri rejects failed commands with the error's message as a plain string.
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            if ("error" in result) throw result.error;
            return result.ok;
          },
          transformCallback: () => 0,
          unregisterCallback: () => undefined,
          convertFileSrc: (path: string) => path,
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { windowLabel: "main", label: "main" },
          },
        };
      });
      await page.goto(path);
      return fake;
    });

    expect(pageErrors, "uncaught errors in the page").toEqual([]);
    for (const fake of backends) {
      expect(fake.unmocked, "commands the fake backend doesn't answer").toEqual([]);
    }
  },
});

export { expect };
