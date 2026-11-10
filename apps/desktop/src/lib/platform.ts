const PLATFORM_NAMES: Readonly<Record<string, string>> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

/** Human-readable name for a Rust `std::env::consts::OS` identifier. */
export function formatPlatform(os: string): string {
  return PLATFORM_NAMES[os] ?? os;
}
