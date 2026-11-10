import {
  ArrowRight,
  Bookmark,
  Check,
  Circle,
  ExternalLink,
  Layers,
  LoaderCircle,
  Search,
  Sparkle,
} from "lucide-react";
import { useState } from "react";

import { Button, Footer, Mark, ScreenHeader } from "@/components/ui";
import { INSTALL_STEPS, type InstallProgress } from "@/services/installer";

const STEP_LABELS: Record<(typeof INSTALL_STEPS)[number], string> = {
  preparing: "Preparing files…",
  extracting: "Extracting resources…",
  configuring: "Configuring application…",
  finalizing: "Finalizing installation…",
};

interface InstallingProps {
  progress: InstallProgress | null;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}

export function InstallingScreen({ progress, error, onRetry, onBack }: InstallingProps) {
  const percent = progress?.percent ?? 0;
  const current = INSTALL_STEPS.indexOf(progress?.step ?? "preparing");
  const isDone = percent === 100;

  return (
    <section className="flex flex-1 flex-col">
      <ScreenHeader
        title="Installing DevAtlas"
        description="Please wait while we install DevAtlas on your computer…"
      />
      <div className="relative mx-auto my-1 grid h-28 w-40 place-items-center">
        <div
          aria-hidden
          className="absolute bottom-2 h-8 w-36 rounded-[50%] bg-accent/35 blur-xl"
        />
        <div className="glow grid size-20 rotate-[-8deg] animate-float place-items-center rounded-2xl border border-accent/40 bg-surface-raised">
          <Mark className="size-12" />
        </div>
      </div>

      <div
        role="progressbar"
        aria-label="Installation progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-raised"
      >
        <div
          className="h-full origin-left rounded-full bg-linear-to-r from-accent-strong to-accent-soft transition-transform duration-300"
          style={{ transform: `scaleX(${String(percent / 100)})` }}
        />
      </div>
      <p className="mt-2 text-center text-sm text-muted">
        {error ? "Installation stopped" : `Installing… ${String(percent)}%`}
      </p>

      {/* Announce step changes and failures, not every percent. */}
      <p className="sr-only" aria-live="polite">
        {error ? "Installation stopped" : STEP_LABELS[INSTALL_STEPS[current] ?? "preparing"]}
      </p>

      {error ? (
        <>
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
          >
            {error}
          </p>
          <Footer>
            <Button variant="secondary" className="w-24" onClick={onBack}>
              Back
            </Button>
            <Button className="w-28" onClick={onRetry}>
              Try again
            </Button>
          </Footer>
        </>
      ) : (
        <ol className="mt-4 flex flex-col gap-2 text-sm">
          {INSTALL_STEPS.map((step, index) => {
            const state =
              index < current || isDone ? "done" : index === current ? "active" : "pending";
            return (
              <li
                key={step}
                className={`flex items-center gap-2.5 ${state === "pending" ? "text-faint" : "text-fg/90"}`}
              >
                {state === "done" && <Check className="size-4 text-accent-soft" aria-hidden />}
                {state === "active" && (
                  <LoaderCircle className="size-4 animate-spin text-accent-soft" aria-hidden />
                )}
                {state === "pending" && <Circle className="size-4" aria-hidden />}
                {STEP_LABELS[step]}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

interface CompleteProps {
  isLaunching: boolean;
  error: string | null;
  onLaunch: () => void;
  onFinish: () => void;
}

export function CompleteScreen({ isLaunching, error, onLaunch, onFinish }: CompleteProps) {
  return (
    <section className="flex flex-1 flex-col items-center text-center">
      <div className="relative mt-6 grid size-28 place-items-center">
        {/* Light rays around the badge, as in the mockup. */}
        {Array.from({ length: 12 }, (_, ray) => (
          <span
            key={ray}
            aria-hidden
            className="absolute h-3 w-0.5 rounded-full bg-success/60"
            style={{ transform: `rotate(${String(ray * 30)}deg) translateY(-54px)` }}
          />
        ))}
        <div className="grid size-20 place-items-center rounded-full border-2 border-success/80 bg-success/10 shadow-[0_0_40px_-6px_var(--color-success)]">
          <Check className="size-10 text-success" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
      <h1 tabIndex={-1} className="mt-6 text-2xl font-semibold tracking-tight outline-none">
        Installation Complete!
      </h1>
      <p className="mt-2 max-w-64 text-sm text-muted">
        DevAtlas has been successfully installed on your computer.
      </p>
      <div className="mt-auto flex w-64 flex-col gap-3 pt-6">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Button disabled={isLaunching} onClick={onLaunch}>
          <ExternalLink className="size-4" /> Launch DevAtlas
        </Button>
        <Button variant="secondary" onClick={onFinish}>
          Finish
        </Button>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Bookmark,
    label: "Capture",
    detail: "Save links, repos and docs the moment you find them.",
  },
  {
    icon: Layers,
    label: "Organize",
    detail: "Your browser bookmarks and saved links in one library.",
  },
  { icon: Search, label: "Discover", detail: "Trending repos, news and rankings for developers." },
];

interface ReadyProps {
  onGetStarted: () => void;
}

export function ReadyScreen({ onGetStarted }: ReadyProps) {
  const [selected, setSelected] = useState(0);
  const feature = FEATURES[selected] ?? FEATURES[0];

  return (
    <section className="flex flex-1 flex-col items-center text-center">
      <AppPreview />
      <h1 tabIndex={-1} className="mt-4 text-2xl font-semibold tracking-tight outline-none">
        Ready to Get Started
      </h1>
      <p className="mt-1 max-w-72 text-sm text-muted">
        Capture, organize, and discover developer resources with DevAtlas.
      </p>

      <div className="mt-4 flex gap-6" role="group" aria-label="DevAtlas features">
        {FEATURES.map(({ icon: Icon, label }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={index === selected}
            onClick={() => {
              setSelected(index);
            }}
            className="group flex flex-col items-center gap-1.5 rounded-lg text-xs text-muted focus-visible:outline-2 focus-visible:outline-accent-soft aria-pressed:text-fg"
          >
            <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface/80 text-accent-soft transition group-aria-pressed:border-accent/60 group-aria-pressed:bg-accent/15">
              <Icon className="size-5" aria-hidden />
            </span>
            {label}
          </button>
        ))}
      </div>
      <p className="mt-3 h-4 text-xs text-fg/75" aria-live="polite">
        {feature?.detail}
      </p>
      <div className="mt-3 flex gap-1.5" aria-hidden>
        {FEATURES.map(({ label }, index) => (
          <span
            key={label}
            className={`size-1.5 rounded-full transition ${index === selected ? "bg-accent-soft" : "bg-line"}`}
          />
        ))}
      </div>

      <Footer>
        <div className="flex w-full justify-center">
          <Button className="w-40" onClick={onGetStarted}>
            Get Started <ArrowRight className="size-4" />
          </Button>
        </div>
      </Footer>
    </section>
  );
}

/** A small DevAtlas window illustration with sparkles. */
function AppPreview() {
  return (
    <div aria-hidden className="relative mt-1 w-56">
      <Sparkle className="absolute -top-1 -left-6 size-4 text-accent-soft" />
      <Sparkle className="absolute top-3 -right-7 size-5 text-accent-soft" />
      <Sparkle className="absolute -bottom-2 -left-3 size-3 text-accent" />
      <div className="glow overflow-hidden rounded-xl border border-accent/40 bg-surface-raised">
        <div className="flex gap-1 border-b border-line px-2.5 py-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-1.5 rounded-full bg-faint" />
          ))}
        </div>
        <div className="flex h-24 gap-2 p-2">
          <div className="flex w-12 flex-col gap-1.5 rounded-md bg-canvas/60 p-1.5">
            <span className="h-1.5 rounded bg-accent/70" />
            <span className="h-1.5 rounded bg-line" />
            <span className="h-1.5 rounded bg-line" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="grid flex-1 place-items-center rounded-md bg-canvas/60">
              <Mark className="size-9" />
            </div>
            <div className="flex gap-2">
              <span className="h-4 flex-1 rounded bg-line" />
              <span className="h-4 w-10 rounded bg-line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
