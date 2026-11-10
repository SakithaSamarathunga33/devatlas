import { useEffect, useRef, useState } from "react";

import { Backdrop, TitleBar } from "@/components/chrome";
import { withAppFolder } from "@/lib/format";
import { CompleteScreen, InstallingScreen, ReadyScreen } from "@/screens/finish-screens";
import {
  LicenseScreen,
  OptionsScreen,
  WelcomeScreen,
  type ChosenOptions,
} from "@/screens/setup-screens";
import {
  closeWindow,
  getAvailableSpace,
  getInstallDefaults,
  install,
  launchApp,
  minimizeWindow,
  pickFolder,
  type InstallDefaults,
  type InstallProgress,
} from "@/services/installer";

type Screen = "welcome" | "license" | "options" | "installing" | "complete" | "ready";

/** Waits for typing to pause before measuring a drive. */
const SPACE_CHECK_DELAY_MS = 300;

const INITIAL_OPTIONS: ChosenOptions = {
  dir: "",
  desktopShortcut: true,
  startMenuShortcut: true,
  launchAfterInstall: false,
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/** Fire-and-forget for window actions, which only fail if the window is already gone. */
function run(action: () => Promise<unknown>) {
  action().catch((error: unknown) => {
    console.error(error);
  });
}

export function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [isCustom, setIsCustom] = useState(false);
  const [defaults, setDefaults] = useState<InstallDefaults | null>(null);
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [isLicenseAccepted, setIsLicenseAccepted] = useState(false);
  // Free space is keyed by the folder it was measured for, so a stale result is never shown.
  const [space, setSpace] = useState<{ dir: string; bytes: number | null } | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Each screen remounts; move focus to its heading so keyboard and screen-reader users follow.
  useEffect(() => {
    mainRef.current?.querySelector("h1")?.focus();
  }, [screen]);

  useEffect(() => {
    getInstallDefaults()
      .then((loaded) => {
        setDefaults(loaded);
        setOptions((current) => ({ ...current, dir: loaded.dir }));
      })
      .catch((cause: unknown) => {
        setError(messageOf(cause));
      });
  }, []);

  useEffect(() => {
    const dir = options.dir;
    if (screen !== "options" || !dir.trim()) return;
    const timer = setTimeout(() => {
      getAvailableSpace(dir)
        .then((bytes) => {
          setSpace({ dir, bytes });
        })
        .catch(() => {
          setSpace({ dir, bytes: null });
        });
    }, SPACE_CHECK_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [screen, options.dir]);

  const availableBytes = space?.dir === options.dir ? space.bytes : null;

  const go = (next: Screen) => {
    setError(null);
    setScreen(next);
  };

  const startInstall = () => {
    go("installing");
    setProgress(null);
    install(options, setProgress)
      .then(() => {
        if (options.launchAfterInstall) launch();
        else setScreen("complete");
      })
      .catch((cause: unknown) => {
        setError(messageOf(cause));
      });
  };

  /** Starts DevAtlas, then shows the "Ready" screen; a failure stays on "Complete" to retry. */
  function launch() {
    setIsLaunching(true);
    launchApp()
      .then(() => {
        go("ready");
      })
      .catch((cause: unknown) => {
        setScreen("complete");
        setError(messageOf(cause));
      })
      .finally(() => {
        setIsLaunching(false);
      });
  }

  const browse = () => {
    pickFolder(options.dir)
      .then((folder) => {
        if (folder) setOptions((current) => ({ ...current, dir: withAppFolder(folder) }));
      })
      .catch((cause: unknown) => {
        setError(messageOf(cause));
      });
  };

  const isInstalling = screen === "installing" && error === null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <Backdrop />
      <TitleBar
        canClose={!isInstalling}
        onMinimize={() => {
          run(minimizeWindow);
        }}
        onClose={() => {
          run(closeWindow);
        }}
      />
      <main
        ref={mainRef}
        key={screen}
        className="relative flex min-h-0 flex-1 animate-enter flex-col px-7 pt-3 pb-7"
      >
        {screen === "welcome" && (
          <WelcomeScreen
            isReady={defaults !== null}
            error={error}
            onInstall={() => {
              // The one-click path always uses the defaults, whatever Customize left behind.
              setOptions({ ...INITIAL_OPTIONS, dir: defaults?.dir ?? "" });
              setIsCustom(false);
              go("license");
            }}
            onCustomize={() => {
              setIsCustom(true);
              go("license");
            }}
          />
        )}
        {screen === "license" && (
          <LicenseScreen
            isAccepted={isLicenseAccepted}
            onAcceptedChange={setIsLicenseAccepted}
            onBack={() => {
              go("welcome");
            }}
            onNext={() => {
              if (isCustom) go("options");
              else startInstall();
            }}
          />
        )}
        {screen === "options" && (
          <OptionsScreen
            options={options}
            requiredBytes={defaults?.requiredBytes ?? 0}
            availableBytes={availableBytes}
            error={error}
            onChange={setOptions}
            onBrowse={browse}
            onBack={() => {
              go("license");
            }}
            onNext={startInstall}
          />
        )}
        {screen === "installing" && (
          <InstallingScreen
            progress={progress}
            error={error}
            onRetry={startInstall}
            onBack={() => {
              go(isCustom ? "options" : "welcome");
            }}
          />
        )}
        {screen === "complete" && (
          <CompleteScreen
            isLaunching={isLaunching}
            error={error}
            onLaunch={() => {
              launch();
            }}
            onFinish={() => {
              run(closeWindow);
            }}
          />
        )}
        {screen === "ready" && (
          <ReadyScreen
            onGetStarted={() => {
              run(closeWindow);
            }}
          />
        )}
      </main>
    </div>
  );
}
