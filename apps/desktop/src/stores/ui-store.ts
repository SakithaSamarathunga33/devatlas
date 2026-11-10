import { create } from "zustand";

export type Theme = "dark" | "light";

const THEME_KEY = "devatlas-theme";

/** Puts the theme on <html> (tokens key off `data-theme`, shadcn's `dark:` off `.dark`) and
 * remembers it; public/theme-init.js reads it back before the next launch's first paint. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable; the choice then lasts for this session only.
  }
}

/** Transient, app-wide UI state. Backend data belongs in TanStack Query, not here. */
interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: Theme;
  toggleTheme: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  // Whatever theme-init.js already applied.
  theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
  toggleTheme: () => {
    set((state) => {
      const theme: Theme = state.theme === "dark" ? "light" : "dark";
      applyTheme(theme);
      return { theme };
    });
  },
}));
