import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Folder,
  HardDrive,
  Layers,
  Search,
  Zap,
} from "lucide-react";
import { useId } from "react";

import license from "../../../../LICENSE?raw";
import { Button, Checkbox, Footer, Mark, ScreenHeader } from "@/components/ui";
import { formatBytes } from "@/lib/format";

const HIGHLIGHTS = [
  { icon: Bookmark, label: "Capture" },
  { icon: Layers, label: "Organize" },
  { icon: Search, label: "Search" },
  { icon: Zap, label: "Discover" },
];

interface WelcomeProps {
  isReady: boolean;
  error: string | null;
  onInstall: () => void;
  onCustomize: () => void;
}

export function WelcomeScreen({ isReady, error, onInstall, onCustomize }: WelcomeProps) {
  return (
    <section className="flex flex-1 flex-col items-center text-center">
      <Mark className="glow mt-2 size-24 animate-float" />
      <h1 tabIndex={-1} className="mt-3 text-4xl font-semibold tracking-tight outline-none">
        Dev<span className="text-accent-soft">Atlas</span>
      </h1>
      <p className="mt-1 text-sm text-muted">Developer Resource Intelligence Platform</p>

      <ul className="mt-6 flex gap-3" aria-label="What DevAtlas does">
        {HIGHLIGHTS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            title={label}
            className="grid size-11 place-items-center rounded-xl border border-line bg-surface/80 text-accent-soft"
          >
            <Icon className="size-5" aria-hidden />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-72 text-sm leading-relaxed text-fg/85">
        Capture, organize, explore, and discover the best developer resources in one place.
      </p>

      <div className="mt-auto flex w-full flex-col items-center gap-3 pt-6">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <Button className="w-64" disabled={!isReady} onClick={onInstall}>
          Install DevAtlas
        </Button>
        <button
          type="button"
          disabled={!isReady}
          onClick={onCustomize}
          className="rounded text-xs text-muted underline underline-offset-4 transition hover:text-fg focus-visible:outline-2 focus-visible:outline-accent-soft disabled:opacity-45"
        >
          Customize Installation
        </button>
      </div>
    </section>
  );
}

const [LICENSE_TITLE = "", ...LICENSE_BODY] = license.trim().split("\n");
// LICENSE is hard-wrapped at 80 columns; reflow each paragraph to the box width.
const LICENSE_PARAGRAPHS = LICENSE_BODY.join("\n")
  .trim()
  .split(/\n\s*\n/)
  .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " "));

interface LicenseProps {
  isAccepted: boolean;
  onAcceptedChange: (isAccepted: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function LicenseScreen({ isAccepted, onAcceptedChange, onBack, onNext }: LicenseProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ScreenHeader
        title="License Agreement"
        description="Please review the license terms before installing DevAtlas."
      />
      <div
        tabIndex={0}
        role="region"
        aria-label="License terms"
        className="min-h-0 flex-1 [scrollbar-color:var(--color-line)_transparent] overflow-y-auto rounded-lg border border-line bg-surface/80 p-4 text-xs leading-relaxed text-fg/80 select-text focus-visible:outline-2 focus-visible:outline-accent-soft"
      >
        <h2 className="mb-3 text-sm font-semibold text-fg">{LICENSE_TITLE}</h2>
        {LICENSE_PARAGRAPHS.map((paragraph) => (
          <p key={paragraph} className="mb-3 last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>
      <div className="mt-4">
        <Checkbox
          label="I agree to the terms of the License Agreement"
          checked={isAccepted}
          onChange={onAcceptedChange}
        />
      </div>
      <Footer>
        <Button variant="secondary" className="w-24" onClick={onBack}>
          Back
        </Button>
        <Button className="w-24" disabled={!isAccepted} onClick={onNext}>
          Next <ArrowRight className="size-4" />
        </Button>
      </Footer>
    </section>
  );
}

export interface ChosenOptions {
  dir: string;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
  launchAfterInstall: boolean;
}

interface OptionsProps {
  options: ChosenOptions;
  requiredBytes: number;
  availableBytes: number | null;
  error: string | null;
  onChange: (options: ChosenOptions) => void;
  onBrowse: () => void;
  onBack: () => void;
  onNext: () => void;
}

export function OptionsScreen(props: OptionsProps) {
  const { options, requiredBytes, availableBytes, error, onChange, onBrowse, onBack, onNext } =
    props;
  const problemId = useId();
  const locationId = useId();
  const isTooSmall = availableBytes !== null && availableBytes < requiredBytes;
  const isEmpty = options.dir.trim().length === 0;
  const problem =
    error ??
    (isEmpty
      ? "Choose a folder to install DevAtlas in."
      : isTooSmall
        ? `Not enough space on this drive. DevAtlas needs ~${formatBytes(requiredBytes)}.`
        : null);
  const set = (patch: Partial<ChosenOptions>) => {
    onChange({ ...options, ...patch });
  };

  return (
    <section className="flex flex-1 flex-col">
      <ScreenHeader
        title="Installation Options"
        description="Choose your installation preferences."
      />

      <label htmlFor={locationId} className="flex items-center gap-2 text-sm font-medium">
        <Folder className="size-4 text-muted" aria-hidden /> Installation Location
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id={locationId}
          value={options.dir}
          spellCheck={false}
          aria-invalid={problem !== null}
          aria-describedby={problem ? problemId : undefined}
          onChange={(event) => {
            set({ dir: event.target.value });
          }}
          className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface/80 px-3 text-sm text-fg outline-none select-text focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
        />
        <Button variant="secondary" onClick={onBrowse}>
          Browse…
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        <Checkbox
          label="Create a desktop shortcut"
          checked={options.desktopShortcut}
          onChange={(desktopShortcut) => {
            set({ desktopShortcut });
          }}
        />
        <Checkbox
          label="Add to Start Menu"
          checked={options.startMenuShortcut}
          onChange={(startMenuShortcut) => {
            set({ startMenuShortcut });
          }}
        />
        <Checkbox
          label="Launch DevAtlas after installation"
          checked={options.launchAfterInstall}
          onChange={(launchAfterInstall) => {
            set({ launchAfterInstall });
          }}
        />
      </div>

      <p
        className={`mt-6 flex items-center gap-2 text-xs ${isTooSmall ? "text-danger" : "text-muted"}`}
      >
        <HardDrive className="size-4" aria-hidden />
        Required Space: ~{formatBytes(requiredBytes)}
        <span aria-hidden className="text-line">
          |
        </span>
        Available Space: {availableBytes === null ? "unknown" : formatBytes(availableBytes)}
      </p>

      <p id={problemId} role="alert" className="mt-3 min-h-4 text-xs text-danger">
        {problem}
      </p>

      <Footer>
        <Button variant="secondary" className="w-24" onClick={onBack}>
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button className="w-24" disabled={isEmpty || isTooSmall} onClick={onNext}>
          Next <ArrowRight className="size-4" />
        </Button>
      </Footer>
    </section>
  );
}
