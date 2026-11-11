"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Palette = "dark" | "light";
type Size = "sm" | "md" | "lg";
type Rgba = number[];

export interface GooeyNavItem {
  label?: string;
  href?: string;
  icon?: ReactNode;
  /** DevAtlas: accessible name when the label is hidden (e.g. an icon-only, collapsed rail). */
  ariaLabel?: string;
}

interface GooeyNavProps {
  items?: GooeyNavItem[];
  initialActiveIndex?: number;
  activeIndex?: number;
  onChange?: (index: number, item: GooeyNavItem) => void;
  theme?: Palette;
  color?: string;
  activeTextColor?: string;
  colors?: string[];
  size?: Size;
  frame?: boolean;
  animationTime?: number;
  particleCount?: number;
  timeVariance?: number;
  spread?: number;
  gooeyness?: number;
  wobble?: number;
  hoverEffect?: boolean;
  className?: string;
  style?: CSSProperties;
  /** DevAtlas: "nav" (links, aria-current) or "toggle" (a filter group, aria-pressed). */
  mode?: "nav" | "toggle";
  /** DevAtlas: accessible name of the nav or group. */
  label?: string;
  /** DevAtlas: "vertical" stacks full-width items (a sidebar). */
  orientation?: "horizontal" | "vertical";
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PillState {
  mass: number;
  scale: number;
  velocity: number;
  outgoing: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  size: number;
  given: number;
  source: number;
  index: number;
  leave: number;
  emerged: number;
  absorbed: number;
  state: "waiting" | "flying" | "absorbing";
  tint: Rgba | null;
  start?: number;
  duration?: number;
  path?: number[];
}

interface Box {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

interface Blob {
  x: number;
  y: number;
  r: number;
  tx: number;
  ty: number;
  tint: Rgba | null;
}

interface Pipeline {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  buffer: WebGLBuffer;
  position: number;
}

const THEMES: Record<Palette, Record<string, string>> = {
  dark: {
    "--gn-frame": "rgba(38, 35, 46, 0.66)",
    "--gn-frame-edge": "rgba(255, 255, 255, 0.08)",
    "--gn-frame-highlight": "rgba(255, 255, 255, 0.07)",
    "--gn-frame-shadow": "0 22px 44px -20px rgba(0, 0, 0, 0.8), 0 6px 16px -8px rgba(0, 0, 0, 0.5)",
    "--gn-ink": "#f4f4f5",
    "--gn-muted": "rgba(244, 244, 245, 0.62)",
  },
  light: {
    "--gn-frame": "rgba(240, 240, 243, 0.8)",
    "--gn-frame-edge": "rgba(24, 24, 27, 0.07)",
    "--gn-frame-highlight": "rgba(255, 255, 255, 0.95)",
    "--gn-frame-shadow":
      "0 22px 44px -22px rgba(24, 24, 27, 0.3), 0 6px 16px -10px rgba(24, 24, 27, 0.16)",
    "--gn-ink": "#27272a",
    "--gn-muted": "rgba(39, 39, 42, 0.62)",
  },
};

const PILLS: Record<Palette, { color: string; hover: string; shadow: number }> = {
  dark: { color: "#f4f4f5", hover: "rgba(255, 255, 255, 0.08)", shadow: 0.4 },
  light: { color: "#27272a", hover: "rgba(24, 24, 27, 0.06)", shadow: 0.2 },
};

const SIZES: Record<Size, Record<string, string>> = {
  sm: {
    "--gn-pad": "5px",
    "--gn-gap": "2px",
    "--gn-font": "13px",
    "--gn-x": "13px",
    "--gn-y": "7px",
  },
  md: {
    "--gn-pad": "6px",
    "--gn-gap": "4px",
    "--gn-font": "14px",
    "--gn-x": "16px",
    "--gn-y": "9px",
  },
  lg: {
    "--gn-pad": "7px",
    "--gn-gap": "6px",
    "--gn-font": "16px",
    "--gn-x": "20px",
    "--gn-y": "11px",
  },
};

const ROOT = "relative inline-flex max-w-full text-[length:var(--gn-font)] leading-[1.2]";
const FRAMED =
  "rounded-full p-[var(--gn-pad)] backdrop-blur-[20px] backdrop-saturate-[1.6] [background:var(--gn-frame)] [box-shadow:var(--gn-frame-shadow)]";
const LIST_BASE = "m-0 flex list-none flex-wrap gap-[var(--gn-gap)] p-0";
const LIST = `relative ${LIST_BASE}`;
const OVERLAY = `${LIST_BASE} pointer-events-none invisible absolute inset-0 text-[var(--gn-active-ink)] [clip-path:inset(100%)]`;
const LINK_BASE =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-full border-none bg-transparent px-[var(--gn-x)] py-[var(--gn-y)] [font-family:inherit] [font-size:inherit] [line-height:inherit] font-medium no-underline";
// DevAtlas: the active label underneath uses the pill's ink (not the page ink), so it can't
// show as a light halo around the dark label drawn on the pill; the keyboard focus ring sits
// just inside the item instead of a bright outline around it.
const LINK = `${LINK_BASE} cursor-pointer text-[var(--gn-muted)] transition-colors duration-200 [-webkit-tap-highlight-color:transparent] group-data-[active]:text-[var(--gn-active-ink)] hover:text-[var(--gn-ink)] group-data-[active]:hover:text-[var(--gn-active-ink)] outline-none focus-visible:outline-[1.5px] focus-visible:-outline-offset-[3px] focus-visible:outline-[var(--gn-muted)] group-data-[active]:focus-visible:outline-[var(--gn-active-ink)]`;
const GHOST = `${LINK_BASE} text-inherit`;
// DevAtlas: with hoverEffect off, hover is a plain CSS fill (instant, no canvas frames); the
// active item keeps its gooey pill underneath, so it gets no fill.
const CSS_HOVER =
  " transition-[color,background-color] duration-100 hover:bg-[var(--gn-hover)] group-data-[active]:hover:bg-transparent";
const ICON = "inline-flex flex-none [&_svg]:h-[1.15em] [&_svg]:w-[1.15em]";
const RIM =
  "pointer-events-none absolute inset-0 rounded-[inherit] [box-shadow:inset_0_0_0_1px_var(--gn-frame-edge),inset_0_1px_0_var(--gn-frame-highlight)]";

const DEFAULT_ITEMS: GooeyNavItem[] = [
  { label: "Home", href: "#" },
  { label: "Work", href: "#" },
  { label: "About", href: "#" },
  { label: "Contact", href: "#" },
];

const MAX_DROPS = 32;
const MAX_PILLS = 4;
const MARGIN = 72;

const VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uSize;
uniform float uRatio;
uniform vec4 uPills[${MAX_PILLS}];
uniform vec4 uHover;
uniform vec4 uDrops[${MAX_DROPS}];
uniform vec2 uTails[${MAX_DROPS}];
uniform vec3 uTints[${MAX_DROPS}];
uniform int uCount;
uniform float uSmooth;
uniform vec3 uPill;
uniform vec4 uHoverColor;
uniform float uShadow;

out vec4 outColor;

float sdPill(vec2 p, vec4 box) {
  vec2 extent = max(box.zw, vec2(0.0));
  float r = min(extent.x, extent.y);
  vec2 q = abs(p - box.xy) - extent + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

vec4 blend(vec4 a, vec4 b, float k) {
  float h = clamp(0.5 + 0.5 * (b.w - a.w) / k, 0.0, 1.0);
  return vec4(mix(b.rgb, a.rgb, h), mix(b.w, a.w, h) - k * h * (1.0 - h));
}

vec4 field(vec2 p) {
  vec4 shape = vec4(uPill, 1e5);
  for (int i = 0; i < ${MAX_PILLS}; i++) {
    vec4 pill = uPills[i];
    if (pill.z <= 0.0) continue;
    shape = blend(shape, vec4(uPill, sdPill(p, pill)), uSmooth);
  }
  for (int i = 0; i < ${MAX_DROPS}; i++) {
    if (i >= uCount) break;
    vec4 drop = uDrops[i];
    if (drop.z <= 0.0) continue;
    float d = sdCapsule(p, drop.xy, drop.xy - uTails[i], drop.z);
    if (d > shape.w + uSmooth) continue;
    shape = blend(shape, vec4(uTints[i], d), uSmooth);
  }
  return shape;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uSize.y * uRatio - gl_FragCoord.y) / uRatio;
  vec4 shape = field(p);
  float d = shape.w;
  float aa = max(fwidth(d), 0.35);
  float body = clamp(0.5 - d / aa, 0.0, 1.0);

  vec2 grad = vec2(dFdx(d), -dFdy(d));
  vec2 n = length(grad) > 0.0001 ? normalize(grad) : vec2(0.0, 1.0);
  float rim = (1.0 - smoothstep(0.0, 1.6, -d)) * max(0.0, -n.y) * 0.3;
  vec3 fill = mix(shape.rgb, vec3(1.0), rim) * (1.0 - 0.06 * max(0.0, n.y) * (1.0 - smoothstep(0.0, 6.0, -d)));

  float lifted = field(p - vec2(0.0, 3.0)).w;
  float shadow = (1.0 - smoothstep(-3.0, 9.0, lifted)) * uShadow * (1.0 - body);

  float hover = clamp(0.5 - sdPill(p, uHover) / aa, 0.0, 1.0) * uHoverColor.a;

  vec4 color = vec4(0.0, 0.0, 0.0, shadow);
  color = vec4(uHoverColor.rgb * hover, hover) + color * (1.0 - hover);
  color = vec4(fill * body, body) + color * (1.0 - body);
  outColor = color;
}
`;

const parse = (value: string): Rgba => {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  const digits = match?.[1];
  if (digits) {
    const hex = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
    return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).concat(1);
  }
  const body = /rgba?\(([^)]+)\)/i.exec(String(value))?.[1];
  if (body) {
    const [r = NaN, g = NaN, b = NaN, a = 1] = body.split(",").map((part) => parseFloat(part));
    return [r / 255, g / 255, b / 255, a];
  }
  return [1, 1, 1, 1];
};

const contrastInk = (rgb: Rgba) => {
  const [r = 0, g = 0, b = 0] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#18161d" : "#ffffff";
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const travelEase = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

const bezier = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

const pillPath = (x: number, y: number, w: number, h: number) => {
  if (w <= 0.5 || h <= 0.5) return "";
  const r = Math.min(w, h) / 2;
  return `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`;
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type) as WebGLShader;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

const UNIFORMS = [
  "uSize",
  "uRatio",
  "uPills",
  "uHover",
  "uDrops",
  "uTails",
  "uTints",
  "uCount",
  "uSmooth",
  "uPill",
  "uHoverColor",
  "uShadow",
];

const build = (gl: WebGL2RenderingContext): Pipeline | null => {
  const program = gl.createProgram() as WebGLProgram;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = Object.fromEntries(
    UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
  );
  const buffer = gl.createBuffer() as WebGLBuffer;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  return { program, uniforms, buffer, position: gl.getAttribLocation(program, "aPosition") };
};

const GooeyNav = ({
  items = DEFAULT_ITEMS,
  initialActiveIndex = 0,
  activeIndex,
  onChange,
  theme = "dark",
  color,
  activeTextColor,
  colors = [],
  size = "md",
  frame = true,
  animationTime = 600,
  particleCount = 15,
  timeVariance = 300,
  spread = 56,
  gooeyness = 0.5,
  wobble = 0.5,
  hoverEffect = true,
  className = "",
  style,
  mode = "nav",
  label,
  orientation = "horizontal",
}: GooeyNavProps) => {
  const [innerIndex, setInnerIndex] = useState(initialActiveIndex);
  const current = Math.min(Math.max(0, activeIndex ?? innerIndex), Math.max(0, items.length - 1));
  // DevAtlas: -1 means no item is active (the current page lives outside this nav).
  const noneActive = activeIndex === -1;
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const overlayRef = useRef<HTMLUListElement>(null);
  const fallbackRef = useRef<HTMLSpanElement>(null);
  const engineRef = useRef<{ go: (index: number) => void; refresh: () => void } | null>(null);
  const indexRef = useRef(current);
  indexRef.current = current;
  const palette = theme === "light" ? "light" : "dark";
  const pillColor = color || PILLS[palette].color;
  const pillRgb = parse(pillColor);
  const settings = {
    animationTime,
    particleCount,
    timeVariance,
    spread,
    gooeyness,
    wobble,
    hoverEffect,
    pillRgb,
    tints: colors.map(parse),
    hoverRgb: parse(PILLS[palette].hover),
    shadow: PILLS[palette].shadow,
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const select = (index: number) => {
    const item = items[index];
    if ((index === current && !noneActive) || !item) return;
    if (activeIndex === undefined) setInnerIndex(index);
    onChange?.(index, item);
  };

  useIsomorphicLayoutEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const list = listRef.current;
    const overlay = overlayRef.current;
    const fallback = fallbackRef.current;
    if (!stage || !canvas || !list || !overlay || !fallback) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    const pipeline = gl ? build(gl) : null;
    fallback.style.display = pipeline ? "none" : "block";
    canvas.style.display = pipeline ? "block" : "none";

    const view = { width: 0, height: 0 };
    let rects: Rect[] = [];
    let target = -1;
    const pills = new Map<number, PillState>();
    const drops: Drop[] = [];
    const hover = { x: 0, y: 0, w: 0, h: 0, alpha: 0, index: -1 };
    const pillData = new Float32Array(MAX_PILLS * 4);
    const dropData = new Float32Array(MAX_DROPS * 4);
    const tailData = new Float32Array(MAX_DROPS * 2);
    const tintData = new Float32Array(MAX_DROPS * 3);
    let raf = 0;
    let last = 0;
    let disposed = false;

    const measure = () => {
      const box = stage.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      view.width = box.width;
      view.height = box.height;
      const outerWidth = box.width + MARGIN * 2;
      const outerHeight = box.height + MARGIN * 2;
      Object.assign(canvas.style, {
        left: `${-MARGIN}px`,
        top: `${-MARGIN}px`,
        width: `${outerWidth}px`,
        height: `${outerHeight}px`,
      });
      const width = Math.max(1, Math.round(outerWidth * ratio));
      const height = Math.max(1, Math.round(outerHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      rects = Array.from(list.children).map((item) => {
        const rect = item.getBoundingClientRect();
        return { x: rect.left - box.left, y: rect.top - box.top, w: rect.width, h: rect.height };
      });
    };

    const trace = (boxes: Box[], blobs: Blob[], smooth: number) => {
      const field = (x: number, y: number) => {
        let d = 1e5;
        const merge = (value: number) => {
          const h = clamp01(0.5 + (0.5 * (value - d)) / smooth);
          d = value + (d - value) * h - smooth * h * (1 - h);
        };
        for (const box of boxes) {
          const r = Math.min(box.hw, box.hh);
          const qx = Math.abs(x - box.cx) - box.hw + r;
          const qy = Math.abs(y - box.cy) - box.hh + r;
          merge(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r);
        }
        for (const blob of blobs) {
          const px = x - blob.x;
          const py = y - blob.y;
          const bx = -blob.tx;
          const by = -blob.ty;
          const span = bx * bx + by * by;
          const h = span > 0.0001 ? clamp01((px * bx + py * by) / span) : 0;
          const value = Math.hypot(px - bx * h, py - by * h) - blob.r;
          if (value > d + smooth) continue;
          merge(value);
        }
        return d;
      };
      const step = 2;
      const parts: string[] = [];
      for (let y = 0; y < view.height; y += 1) {
        const cy = y + 0.5;
        let previous = field(0, cy);
        let start: number | null = previous < 0 ? 0 : null;
        for (let x = step; x <= view.width + step; x += step) {
          const value = field(Math.min(x, view.width), cy);
          if (previous < 0 !== value < 0) {
            const cross = x - step + (step * previous) / (previous - value);
            if (value < 0) start = cross;
            else if (start !== null) {
              parts.push(
                `M${start.toFixed(1)},${y}H${cross.toFixed(1)}V${y + 1}H${start.toFixed(1)}Z`,
              );
              start = null;
            }
          }
          previous = value;
        }
        if (start !== null)
          parts.push(`M${start.toFixed(1)},${y}H${view.width}V${y + 1}H${start.toFixed(1)}Z`);
      }
      return parts.join("");
    };

    const pill = (index: number): PillState => {
      if (!pills.has(index)) pills.set(index, { mass: 0, scale: 0, velocity: 0, outgoing: 0 });
      return pills.get(index) as PillState;
    };

    const shape = (index: number, amount: number): Rect | null => {
      const rect = rects[index];
      if (!rect || amount <= 0.002) return null;
      const h = rect.h * Math.min(1.08, 0.42 + 0.58 * Math.sqrt(Math.max(0, amount)));
      const w = Math.max(h, rect.w * Math.max(0, amount) ** 0.75);
      return { x: rect.x + rect.w / 2 - w / 2, y: rect.y + rect.h / 2 - h / 2, w, h };
    };

    const plan = (drop: Drop, index: number, now: number, fresh: boolean) => {
      const s = settingsRef.current;
      const rect = rects[index];
      if (!rect) return;
      const reach = Math.max(0, s.spread);
      const ex = rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.45;
      const ey = rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.2;
      const base = Math.max(0.15, s.animationTime / 1000);
      const variance = (Math.random() - 0.5) * (Math.max(0, s.timeVariance) / 1000);
      const duration = Math.max(0.15, base * (0.62 + Math.random() * 0.32) + variance * 0.6);
      const out = Math.random() * Math.PI * 2;
      const into = Math.random() * Math.PI * 2;
      const burst = reach * (0.7 + Math.random() * 0.6);
      const swing = reach * (0.55 + Math.random() * 0.55);
      const carry = Math.min(duration / 3, 0.12);
      drop.index = index;
      drop.start = now;
      drop.duration = duration;
      drop.path = [
        drop.x,
        drop.y,
        fresh ? drop.x + Math.cos(out) * burst * 1.6 : drop.x + drop.vx * carry,
        fresh ? drop.y + Math.sin(out) * burst * 1.6 : drop.y + drop.vy * carry,
        ex + Math.cos(into) * swing * 1.5,
        ey + Math.sin(into) * swing * 1.5,
        ex,
        ey,
      ];
    };

    const emit = (from: number, to: number, now: number) => {
      const s = settingsRef.current;
      const source = pills.get(from);
      const rect = rects[from];
      if (!source || !rect || !rects[to]) return;
      const available = source.mass - source.outgoing;
      if (available <= 0.002) return;
      const room = MAX_DROPS - drops.length;
      const count = Math.min(
        room,
        Math.max(1, Math.round(Math.max(1, s.particleCount) * available)),
      );
      if (count <= 0) return;
      const window = Math.max(0.15, s.animationTime / 1000) * 0.16;
      for (let i = 0; i < count; i++) {
        const mass = available / count;
        source.outgoing += mass;
        drops.push({
          x: rect.x + rect.w / 2 + (Math.random() - 0.5) * rect.w * 0.6,
          y: rect.y + rect.h / 2 + (Math.random() - 0.5) * rect.h * 0.3,
          vx: 0,
          vy: 0,
          mass,
          size: 0.8 + Math.random() * 0.4,
          given: 0,
          source: from,
          index: to,
          leave: now + Math.random() * window * 1000,
          emerged: 0,
          absorbed: 0,
          state: "waiting",
          tint: s.tints[Math.floor(Math.random() * s.tints.length)] ?? null,
        });
      }
    };

    const render = () => {
      const s = settingsRef.current;
      const height = rects[target]?.h ?? rects[0]?.h ?? 36;
      const smooth = height * (0.18 + 0.5 * clamp01(s.gooeyness));
      const boxes: Box[] = [];
      const blobs: Blob[] = [];
      for (const [index, state] of pills) {
        const box = shape(index, state.scale);
        if (box)
          boxes.push({
            cx: box.x + box.w / 2,
            cy: box.y + box.h / 2,
            hw: box.w / 2,
            hh: box.h / 2,
          });
      }
      for (const drop of drops) {
        if (drop.state === "waiting") continue;
        const radius = 0.26 * height * drop.size * Math.min(drop.emerged, 1 - drop.absorbed);
        if (radius <= 0.05) continue;
        const speed = Math.hypot(drop.vx, drop.vy);
        const length = Math.min(radius * 1.1, speed * 0.018);
        blobs.push({
          x: drop.x,
          y: drop.y,
          r: radius,
          tx: speed > 0.01 ? (drop.vx / speed) * length : 0,
          ty: speed > 0.01 ? (drop.vy / speed) * length : 0,
          tint: drop.tint,
        });
      }

      const settledPill = boxes.length === 1 && !blobs.length ? boxes[0] : undefined;
      if (settledPill) {
        const { cx, cy, hw, hh } = settledPill;
        overlay.style.clipPath = `path('${pillPath(cx - hw, cy - hh, hw * 2, hh * 2)}')`;
      } else {
        overlay.style.clipPath = `path('${trace(boxes, blobs, smooth) || "M0,0Z"}')`;
      }
      overlay.style.visibility = "visible";

      if (!pipeline || !gl) {
        const box = shape(target, 1);
        if (box) {
          fallback.style.transform = `translate(${box.x.toFixed(2)}px, ${box.y.toFixed(2)}px)`;
          fallback.style.width = `${box.w}px`;
          fallback.style.height = `${box.h}px`;
        }
        fallback.style.opacity = box ? "1" : "0";
        return;
      }

      let slot = 0;
      for (const box of boxes) {
        if (slot >= MAX_PILLS) break;
        pillData[slot * 4] = box.cx + MARGIN;
        pillData[slot * 4 + 1] = box.cy + MARGIN;
        pillData[slot * 4 + 2] = box.hw;
        pillData[slot * 4 + 3] = box.hh;
        slot += 1;
      }
      pillData.fill(0, slot * 4);
      let count = 0;
      for (const blob of blobs) {
        if (count >= MAX_DROPS) break;
        dropData[count * 4] = blob.x + MARGIN;
        dropData[count * 4 + 1] = blob.y + MARGIN;
        dropData[count * 4 + 2] = blob.r;
        dropData[count * 4 + 3] = 0;
        tailData[count * 2] = blob.tx;
        tailData[count * 2 + 1] = blob.ty;
        const [tr = 0, tg = 0, tb = 0] = blob.tint || s.pillRgb;
        tintData[count * 3] = tr;
        tintData[count * 3 + 1] = tg;
        tintData[count * 3 + 2] = tb;
        count += 1;
      }

      const { program, uniforms, buffer, position } = pipeline;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const at = (name: string) => uniforms[name] ?? null;
      const [pr = 0, pg = 0, pb = 0] = s.pillRgb;
      const [hr = 0, hg = 0, hb = 0, ha = 1] = s.hoverRgb;
      gl.uniform2f(at("uSize"), view.width + MARGIN * 2, view.height + MARGIN * 2);
      gl.uniform1f(at("uRatio"), canvas.width / Math.max(1, view.width + MARGIN * 2));
      gl.uniform4fv(at("uPills"), pillData);
      gl.uniform4f(at("uHover"), hover.x + MARGIN, hover.y + MARGIN, hover.w / 2, hover.h / 2);
      gl.uniform4fv(at("uDrops"), dropData);
      gl.uniform2fv(at("uTails"), tailData);
      gl.uniform3fv(at("uTints"), tintData);
      gl.uniform1i(at("uCount"), count);
      gl.uniform1f(at("uSmooth"), smooth);
      gl.uniform3f(at("uPill"), pr, pg, pb);
      gl.uniform4f(at("uHoverColor"), hr, hg, hb, ha * hover.alpha);
      gl.uniform1f(at("uShadow"), s.shadow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = (now: number) => {
      raf = 0;
      const s = settingsRef.current;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      const emergeTime = 0.09;
      const absorbTime = 0.12;

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        if (!drop) continue;
        if (drop.state === "waiting") {
          if (now < drop.leave) continue;
          drop.state = "flying";
          plan(drop, drop.index, now, true);
        }
        if (drop.state === "flying") {
          drop.emerged = Math.min(1, drop.emerged + dt / emergeTime);
          const source = pills.get(drop.source);
          if (source && drop.given < drop.mass) {
            const step = Math.min(drop.mass * (dt / emergeTime), drop.mass - drop.given);
            source.mass = Math.max(0, source.mass - step);
            source.outgoing = Math.max(0, source.outgoing - step);
            drop.given += step;
          }
          const t = clamp01((now - (drop.start ?? now)) / 1000 / (drop.duration ?? 1));
          const eased = travelEase(t);
          const [
            x0 = drop.x,
            y0 = drop.y,
            x1 = drop.x,
            y1 = drop.y,
            x2 = drop.x,
            y2 = drop.y,
            x3 = drop.x,
            y3 = drop.y,
          ] = drop.path ?? [];
          const x = bezier(x0, x1, x2, x3, eased);
          const y = bezier(y0, y1, y2, y3, eased);
          if (dt > 0) {
            drop.vx = (x - drop.x) / dt;
            drop.vy = (y - drop.y) / dt;
          }
          drop.x = x;
          drop.y = y;
          if (t >= 1) drop.state = "absorbing";
        }
        if (drop.state === "absorbing") {
          const step = Math.min(1 - drop.absorbed, dt / absorbTime);
          drop.absorbed += step;
          drop.vx *= 0.8;
          drop.vy *= 0.8;
          const host = pill(drop.index);
          host.mass = Math.min(1, host.mass + drop.mass * step);
          if (drop.absorbed >= 1) drops.splice(i, 1);
        }
      }

      const zeta = reduced ? 1 : 1 - 0.72 * clamp01(s.wobble);
      const omega = 26;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (const [index, state] of pills) {
        for (let n = 0; n < steps; n++) {
          state.velocity +=
            (omega * omega * (state.mass - state.scale) - 2 * zeta * omega * state.velocity) * h;
          state.scale += state.velocity * h;
        }
        if (
          index !== target &&
          state.mass <= 0.002 &&
          state.outgoing <= 0.002 &&
          Math.abs(state.scale) < 0.004
        ) {
          pills.delete(index);
        }
      }

      const rect = hover.index >= 0 ? rects[hover.index] : undefined;
      if (rect) {
        const k = 1 - Math.exp(-dt / 0.06);
        hover.x += (rect.x + rect.w / 2 - hover.x) * k;
        hover.y += (rect.y + rect.h / 2 - hover.y) * k;
        hover.w += (rect.w - hover.w) * k;
        hover.h += (rect.h - hover.h) * k;
      }
      const hoverGoal = s.hoverEffect && hover.index >= 0 && hover.index !== target ? 1 : 0;
      hover.alpha += (hoverGoal - hover.alpha) * (1 - Math.exp(-dt / 0.08));

      render();

      const host = pills.get(target);
      const resting =
        drops.length === 0 &&
        pills.size === 1 &&
        host &&
        Math.abs(host.mass - host.scale) < 0.0008 &&
        Math.abs(host.velocity) < 0.004;
      const hoverRect = rects[hover.index];
      const hovering =
        Math.abs(hoverGoal - hover.alpha) > 0.003 ||
        (hoverRect &&
          Math.abs(hoverRect.x + hoverRect.w / 2 - hover.x) + Math.abs(hoverRect.w - hover.w) >
            0.1);
      if (!resting || hovering) raf = requestAnimationFrame(frame);
      else {
        host.mass = 1;
        host.scale = 1;
        host.velocity = 0;
        hover.alpha = hoverGoal;
        render();
      }
    };

    const wake = () => {
      if (raf || disposed) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const settle = (index: number) => {
      pills.clear();
      drops.length = 0;
      target = index;
      const state = pill(index);
      state.mass = 1;
      state.scale = 1;
      state.velocity = 0;
      render();
    };

    const go = (index: number, animate: boolean) => {
      if (index === target) return;
      if (!rects[index] || !animate || reduced || target < 0) {
        settle(index);
        return;
      }
      const now = performance.now();
      target = index;
      pill(index);
      for (const drop of drops) {
        drop.index = index;
        if (drop.state === "flying") plan(drop, index, now, false);
        if (drop.state === "absorbing") {
          drop.state = "flying";
          drop.mass *= 1 - drop.absorbed;
          drop.absorbed = 0;
          plan(drop, index, now, false);
        }
      }
      for (const from of [...pills.keys()]) {
        if (from !== index) emit(from, index, now);
      }
      wake();
    };

    const onOver = (event: PointerEvent) => {
      const item = (event.target as Element).closest<HTMLElement>("[data-gooey-index]");
      if (!item || !list.contains(item)) return;
      const index = Number(item.dataset.gooeyIndex);
      const rect = rects[index];
      if (!rect) return;
      if (hover.alpha < 0.01) {
        hover.x = rect.x + rect.w / 2;
        hover.y = rect.y + rect.h / 2;
        hover.w = rect.w;
        hover.h = rect.h;
      }
      hover.index = index;
      wake();
    };

    const onLeave = () => {
      hover.index = -1;
      wake();
    };

    const resizeObserver = new ResizeObserver(() => {
      measure();
      if (!drops.length) settle(target < 0 ? indexRef.current : target);
      else render();
    });
    resizeObserver.observe(stage);
    resizeObserver.observe(list);

    list.addEventListener("pointerover", onOver);
    list.addEventListener("pointerleave", onLeave);

    measure();
    settle(indexRef.current);
    document.fonts?.ready.then(() => {
      if (disposed) return;
      measure();
      if (!drops.length) settle(target);
    });

    engineRef.current = {
      go: (index) => go(index, true),
      refresh: () => {
        render();
        wake();
      },
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      list.removeEventListener("pointerover", onOver);
      list.removeEventListener("pointerleave", onLeave);
      if (gl && pipeline) {
        gl.deleteBuffer(pipeline.buffer);
        gl.deleteProgram(pipeline.program);
      }
      engineRef.current = null;
    };
  }, [items.length]);

  useEffect(() => {
    engineRef.current?.go(current);
  }, [current]);

  useEffect(() => {
    engineRef.current?.refresh();
  }, [pillColor, palette, gooeyness, size, frame]);

  const textColor = activeTextColor || contrastInk(pillRgb);

  const vertical = orientation === "vertical";
  const listClass = vertical ? `${LIST} flex-col flex-nowrap` : LIST;
  const overlayClass = vertical ? `${OVERLAY} flex-col flex-nowrap` : OVERLAY;
  const itemWidth = vertical ? " w-full justify-start" : "";
  const linkClass = LINK + (hoverEffect ? "" : CSS_HOVER) + itemWidth;

  const labels = (interactive: boolean) =>
    items.map((item, index) => {
      const content = (
        <>
          {item.icon && <span className={ICON}>{item.icon}</span>}
          {item.label && <span>{item.label}</span>}
        </>
      );
      if (!interactive) {
        return (
          <li key={index} className={vertical ? "flex w-full" : "flex"}>
            <span className={GHOST + itemWidth}>{content}</span>
          </li>
        );
      }
      const shared = {
        className: linkClass,
        "aria-label": item.ariaLabel,
        ...(mode === "toggle"
          ? { "aria-pressed": index === current }
          : { "aria-current": index === current && !noneActive ? ("page" as const) : undefined }),
        onClick: (event: MouseEvent) => {
          if (!item.href || item.href === "#") event.preventDefault();
          select(index);
        },
      };
      return (
        <li
          key={index}
          // A filter group is a set of toggle buttons, not a list.
          role={mode === "toggle" ? "none" : undefined}
          className={vertical ? "group flex w-full" : "group flex"}
          data-gooey-index={index}
          data-active={index === current && !noneActive ? "" : undefined}
        >
          {item.href ? (
            <a href={item.href} {...shared}>
              {content}
            </a>
          ) : (
            <button type="button" {...shared}>
              {content}
            </button>
          )}
        </li>
      );
    });

  const Root = mode === "toggle" ? "div" : "nav";
  return (
    <Root
      role={mode === "toggle" ? "group" : undefined}
      aria-label={label}
      className={`${ROOT}${frame ? ` ${FRAMED}` : ""} ${className}`.trim()}
      style={
        {
          ...(SIZES[size] ?? SIZES.md),
          ...THEMES[palette],
          "--gn-pill": pillColor,
          "--gn-hover": PILLS[palette].hover,
          "--gn-active-ink": textColor,
          ...style,
        } as CSSProperties
      }
    >
      {frame && <span className={RIM} />}
      <div ref={stageRef} className={vertical ? "relative w-full" : "relative max-w-full"}>
        <canvas
          ref={canvasRef}
          className={`pointer-events-none absolute top-0 left-0${noneActive ? " opacity-0" : ""}`}
          aria-hidden="true"
        />
        <span
          ref={fallbackRef}
          className={`pointer-events-none absolute top-0 left-0 hidden rounded-full bg-[var(--gn-pill)]${noneActive ? " opacity-0" : ""}`}
          aria-hidden="true"
        />
        <ul ref={listRef} role={mode === "toggle" ? "none" : undefined} className={listClass}>
          {labels(true)}
        </ul>
        <ul
          ref={overlayRef}
          className={`${overlayClass}${noneActive ? " opacity-0" : ""}`}
          aria-hidden="true"
        >
          {labels(false)}
        </ul>
      </div>
    </Root>
  );
};

export default GooeyNav;
