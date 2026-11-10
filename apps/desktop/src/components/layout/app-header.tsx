import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, PanelLeftClose, PanelLeftOpen, Search, Square, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";

import { primaryNavigation, secondaryNavigation } from "@/components/layout/navigation";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { Button, buttonVariants } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/use-page-title";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/** Top bar: also the window's drag area, with the window controls on the right. */
export function AppHeader() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  // The Library, Discovery and News pages have their own, larger search.
  const pathname = useLocation().pathname;
  const pageHasSearch = ["/library", "/discovery", "/news"].includes(pathname);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        // The header's search, or the page's own search on Library, Discovery and News.
        document.querySelector<HTMLInputElement>("[data-search-shortcut]")?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => {
      window.removeEventListener("keydown", focusSearch);
    };
  }, []);

  return (
    <header
      data-tauri-drag-region
      className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background pl-4"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="text-muted-foreground hover:bg-accent"
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </Button>
      <PageTitle pathname={pathname} />
      <div data-tauri-drag-region className="flex h-full flex-1 items-center justify-center px-4">
        {!pageHasSearch && <HeaderSearch />}
      </div>
      <ThemeToggle />
      <WindowControls />
    </header>
  );
}

/** Magic UI's animated theme toggler: the new theme sweeps out from the button in a circle
 * (View Transitions API), driving the app's own theme state. */
function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={setTheme}
      duration={500}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon-sm" }),
        "text-muted-foreground hover:bg-accent",
      )}
    />
  );
}

/** The current page's name and icon, so the header says where you are. */
function PageTitle({ pathname }: { pathname: string }) {
  const title = usePageTitle();
  const section = [...primaryNavigation, ...secondaryNavigation].find(
    (item) =>
      item.to !== undefined && (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)),
  );
  const Icon = section?.icon;
  return (
    <p
      data-tauri-drag-region
      className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground"
    >
      {Icon !== undefined && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      {title}
    </p>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        const query = input.current?.value.trim() ?? "";
        void navigate(query === "" ? "/library" : `/library?q=${encodeURIComponent(query)}`);
      }}
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <input
        ref={input}
        data-search-shortcut
        type="search"
        aria-label="Search resources"
        placeholder="Search resources, tools, or topics…"
        className="h-9 w-full rounded-lg border border-input bg-card pr-16 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring/30"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 rounded border border-input bg-secondary px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
        Ctrl K
      </kbd>
    </form>
  );
}

const windowButton =
  "flex h-full w-12 items-center justify-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent [&_svg]:size-4";

/** Minimize / maximize / close, replacing the native title bar (the window is undecorated). */
function WindowControls() {
  if (!isTauri()) return null;
  const run = (action: "minimize" | "toggleMaximize" | "close") => {
    getCurrentWindow()
      [action]()
      .catch((error: unknown) => {
        console.warn(`Window ${action} failed.`, error);
      });
  };
  return (
    <div className="flex h-full self-stretch">
      <button
        type="button"
        aria-label="Minimize"
        className={windowButton}
        onClick={() => {
          run("minimize");
        }}
      >
        <Minus />
      </button>
      <button
        type="button"
        aria-label="Maximize or restore"
        className={cn(windowButton, "[&_svg]:size-3.5")}
        onClick={() => {
          run("toggleMaximize");
        }}
      >
        <Square />
      </button>
      <button
        type="button"
        aria-label="Close"
        className={cn(windowButton, "hover:bg-red-600 hover:text-white")}
        onClick={() => {
          run("close");
        }}
      >
        <X />
      </button>
    </div>
  );
}
