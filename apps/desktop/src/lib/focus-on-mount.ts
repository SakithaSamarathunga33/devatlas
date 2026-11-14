/** A ref callback that focuses its element once, when it mounts. Module-level so React keeps
 * the same callback across renders and doesn't refocus on every one. */
export function focusOnMount(element: HTMLElement | null): void {
  element?.focus();
}
