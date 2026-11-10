import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { z } from "zod";

import { invokeCommand } from "@/services/ipc";

/** Area the in-app viewer covers, in CSS pixels relative to the window's content. */
export interface ViewerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ViewerAction = "back" | "forward" | "reload";

const pageLoadSchema = z.object({ url: z.string(), loading: z.boolean() });
export type ViewerPageLoad = z.infer<typeof pageLoadSchema>;

/** Rust `()` results arrive as `null`. */
const done = z.null();

// Viewer commands run on the backend's async runtime; chaining them keeps an open → close →
// open sequence (e.g. React StrictMode remounts) in the order it was issued.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export function openViewer(url: string, bounds: ViewerBounds): Promise<null> {
  return serial(() => invokeCommand("viewer_open", done, { url, bounds }));
}

export function setViewerBounds(bounds: ViewerBounds): Promise<null> {
  return serial(() => invokeCommand("viewer_set_bounds", done, { bounds }));
}

export function closeViewer(): Promise<null> {
  return serial(() => invokeCommand("viewer_close", done));
}

export function viewerGo(action: ViewerAction): Promise<null> {
  return serial(() => invokeCommand("viewer_go", done, { action }));
}

/** Subscribes to page loads inside the viewer (navigation start and finish). */
export function onViewerPageLoad(handler: (event: ViewerPageLoad) => void): Promise<UnlistenFn> {
  return listen<unknown>("viewer://page-load", (event) => {
    const parsed = pageLoadSchema.safeParse(event.payload);
    if (parsed.success) handler(parsed.data);
  });
}

export function boundsOf(element: HTMLElement): ViewerBounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}
