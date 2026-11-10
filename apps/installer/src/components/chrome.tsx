import { Minus, X } from "lucide-react";

import { Mark } from "@/components/ui";

interface TitleBarProps {
  onMinimize: () => void;
  onClose: () => void;
  canClose: boolean;
}

const CONTROL =
  "grid h-8 w-10 place-items-center rounded-md text-muted transition hover:bg-white/8 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent-soft disabled:pointer-events-none disabled:opacity-30";

/** Frameless window title bar; the label area drags the window. */
export function TitleBar({ onMinimize, onClose, canClose }: TitleBarProps) {
  return (
    <div className="relative z-10 flex h-10 shrink-0 items-center pl-4" data-tauri-drag-region>
      <Mark className="pointer-events-none size-4" />
      <span className="pointer-events-none ml-2 text-xs font-medium text-fg/90">
        DevAtlas Installer
      </span>
      <div className="ml-auto flex pr-1">
        <button type="button" aria-label="Minimize" className={CONTROL} onClick={onMinimize}>
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Close"
          title={canClose ? undefined : "Setup can close once installation finishes"}
          disabled={!canClose}
          className={`${CONTROL} hover:bg-danger/80 hover:text-white`}
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** The flowing light ribbons behind every screen, drawn once as decoration. */
export function Backdrop() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full opacity-70"
      viewBox="0 0 480 520"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="ribbon" x1="0" x2="1">
          <stop offset="0" stopColor="#17a3ab" stopOpacity="0" />
          <stop offset="0.5" stopColor="#8bdde2" stopOpacity="0.7" />
          <stop offset="1" stopColor="#20c5ce" stopOpacity="0" />
        </linearGradient>
        <filter id="soften">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <g fill="none" stroke="url(#ribbon)" filter="url(#soften)">
        <path d="M-20 140 C 120 60, 260 200, 500 70" strokeWidth="1.4" />
        <path d="M-20 160 C 140 90, 280 230, 500 100" strokeWidth="0.8" opacity="0.6" />
        <path d="M-20 470 C 140 380, 300 520, 500 400" strokeWidth="1.4" />
        <path d="M-20 495 C 160 420, 320 540, 500 430" strokeWidth="0.8" opacity="0.6" />
      </g>
    </svg>
  );
}
