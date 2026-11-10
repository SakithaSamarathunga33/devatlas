import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

const BUTTON_BASE =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-5 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-accent-soft focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-45";

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const look =
    variant === "primary"
      ? "btn-primary text-canvas"
      : "border border-line bg-surface-raised/70 text-fg hover:bg-surface-raised";
  return <button type={type} className={`${BUTTON_BASE} ${look} ${className}`} {...props} />;
}

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="size-[18px] cursor-pointer rounded accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-soft"
      />
      {label}
    </label>
  );
}

/** Heading block shared by the step screens. */
export function ScreenHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-5">
      <h1 tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
        {title}
      </h1>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </header>
  );
}

/** Bottom-right navigation row of the step screens. */
export function Footer({ children }: { children: ReactNode }) {
  return <footer className="mt-auto flex justify-end gap-3 pt-5">{children}</footer>;
}

export function Mark({ className = "" }: { className?: string }) {
  return <img src="/devatlas-mark.png" alt="" draggable={false} className={className} />;
}
