// Magic UI — Globe (https://magicui.design/docs/components/globe), built on cobe.
// Adapted for DevAtlas: brand colours, no decorative markers, honours reduced motion,
// and fails quietly when the webview cannot create a WebGL context.
import createGlobe, { type COBEOptions } from "cobe";
import { useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const MOVEMENT_DAMPING = 1400;
const AUTO_ROTATION_SPEED = 0.003;

const DEVATLAS_GLOBE: Omit<COBEOptions, "width" | "height" | "onRender"> = {
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.28,
  dark: 1,
  diffuse: 1.4,
  mapSamples: 16000,
  mapBrightness: 5,
  baseColor: [0.2, 0.16, 0.38],
  markerColor: [0.55, 0.42, 1],
  glowColor: [0.32, 0.26, 0.85],
  markers: [],
};

export function Globe({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);
  const dragStartX = useRef<number | null>(null);
  const reduceMotion = useReducedMotion();

  const rotation = useMotionValue(0);
  const smoothRotation = useSpring(rotation, { mass: 1, damping: 30, stiffness: 100 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const onResize = () => {
      widthRef.current = canvas.offsetWidth;
    };
    window.addEventListener("resize", onResize);
    onResize();

    let globe: ReturnType<typeof createGlobe>;
    try {
      globe = createGlobe(canvas, {
        ...DEVATLAS_GLOBE,
        width: widthRef.current * 2,
        height: widthRef.current * 2,
        onRender: (state) => {
          if (dragStartX.current === null && !reduceMotion) phiRef.current += AUTO_ROTATION_SPEED;
          state.phi = phiRef.current + smoothRotation.get();
          state.width = widthRef.current * 2;
          state.height = widthRef.current * 2;
        },
      });
    } catch (error) {
      console.warn("Globe disabled: WebGL is unavailable.", error);
      window.removeEventListener("resize", onResize);
      return undefined;
    }

    const reveal = window.setTimeout(() => {
      canvas.style.opacity = "1";
    }, 0);
    return () => {
      window.clearTimeout(reveal);
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [reduceMotion, smoothRotation]);

  const setDragging = (startX: number | null) => {
    dragStartX.current = startX;
    if (canvasRef.current) canvasRef.current.style.cursor = startX === null ? "grab" : "grabbing";
  };

  const drag = (clientX: number) => {
    if (dragStartX.current === null) return;
    // Apply only the movement since the last event so the spin tracks the pointer.
    rotation.set(rotation.get() + (clientX - dragStartX.current) / MOVEMENT_DAMPING);
    dragStartX.current = clientX;
  };

  return (
    <div className={cn("absolute inset-0 mx-auto aspect-square w-full", className)}>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="size-full cursor-grab opacity-0 transition-opacity duration-700 contain-[layout_paint_size]"
        onPointerDown={(event) => {
          setDragging(event.clientX);
        }}
        onPointerUp={() => {
          setDragging(null);
        }}
        onPointerOut={() => {
          setDragging(null);
        }}
        onPointerMove={(event) => {
          drag(event.clientX);
        }}
      />
    </div>
  );
}
