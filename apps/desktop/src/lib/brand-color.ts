/** Brand ink: these are fixed colours on a brand-coloured tile, not theme colours. */
const LIGHT_INK = "#ffffff";
const DARK_INK = "#000000";

function luminance(hex: string): number {
  const channels = [0, 2, 4].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [red = 0, green = 0, blue = 0] = channels;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** A tile in a brand's colour (Simple Icons hex, no `#`) with whichever ink reads best on it. */
export function brandTile(hex: string): { background: string; ink: string } | undefined {
  if (!/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  const background = luminance(hex);
  const ink = contrast(background, 1) >= contrast(background, 0) ? LIGHT_INK : DARK_INK;
  return { background: `#${hex}`, ink };
}
