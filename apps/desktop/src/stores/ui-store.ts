import { create } from "zustand";

export type Theme = "dark" | "light";

const THEME_KEY = "devatlas-theme";

/** Puts the theme on <html> (chart tokens key off `.dark`; Astryx's Theme keeps `data-theme` in
 * step) and remembers it; public/theme-init.js reads it back before the next launch's first paint. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset.theme = theme;
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
  setTheme: (theme: Theme) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },
  // Whatever theme-init.js already applied.
  theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },
}));
