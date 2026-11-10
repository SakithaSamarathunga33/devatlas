/**
 * Whether WebGL rendering should be attempted. False in jsdom/tests. Components that use
 * WebGL still handle context-creation failure (blocklisted GPU, disabled acceleration).
 */
export const supportsWebGL: boolean =
  typeof window !== "undefined" && "WebGL2RenderingContext" in window;
