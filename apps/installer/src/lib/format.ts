const MB = 1024 ** 2;
const GB = 1024 ** 3;

/** "< 1 MB", "320 MB" below a gigabyte, "128.4 GB" above. */
export function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`;
  if (bytes < MB) return "< 1 MB";
  return `${String(Math.round(bytes / MB))} MB`;
}

const APP_FOLDER = "DevAtlas";

/** Installers put the app in its own folder: picking `D:\Apps` installs to `D:\Apps\DevAtlas`. */
export function withAppFolder(folder: string): string {
  const trimmed = folder.replace(/[\\/]+$/, "");
  const last = trimmed.split(/[\\/]/).pop() ?? "";
  if (last.toLowerCase() === APP_FOLDER.toLowerCase()) return trimmed;
  // A bare drive root ("D:") still needs its separator.
  return `${trimmed}\\${APP_FOLDER}`;
}
