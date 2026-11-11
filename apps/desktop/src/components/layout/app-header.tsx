import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Moon, Square, Sun, X } from "lucide-react";

import { CommandPalette } from "@/features/search";
import { useUiStore } from "@/stores/ui-store";

/** Top bar: also the window's drag area, with the window controls on the right. */
export function AppHeader() {
  return (
    <div data-tauri-drag-region="deep">
      <TopNav
        label="Application"
        heading={
          <TopNavHeading
            heading="DevAtlas"
            logo={<img src="/devatlas-mark.png" alt="" width={24} height={24} />}
          />
        }
        centerContent={
          // The palette's dialog renders in place; without this, its backdrop would drag the window.
          <div data-tauri-drag-region="false">
            <CommandPalette />
          </div>
        }
        endContent={
          <>
            <ThemeToggle />
            <WindowControls />
          </>
        }
      />
    </div>
  );
}

function ThemeToggle() {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      label={`Switch to ${next} theme`}
      variant="ghost"
      size="sm"
      isIconOnly
      icon={<Icon icon={theme === "dark" ? Sun : Moon} />}
      onClick={() => {
        setTheme(next);
      }}
    />
  );
}

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
    <>
      <Button
        label="Minimize"
        variant="ghost"
        size="sm"
        isIconOnly
        icon={<Icon icon={Minus} />}
        onClick={() => {
          run("minimize");
        }}
      />
      <Button
        label="Maximize or restore"
        variant="ghost"
        size="sm"
        isIconOnly
        icon={<Icon icon={Square} />}
        onClick={() => {
          run("toggleMaximize");
        }}
      />
      <Button
        label="Close"
        variant="ghost"
        size="sm"
        isIconOnly
        icon={<Icon icon={X} />}
        onClick={() => {
          run("close");
        }}
      />
    </>
  );
}
