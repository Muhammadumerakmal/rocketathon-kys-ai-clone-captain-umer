"use client";

import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import {
  idleRadius,
  MISS_VELOCITY,
  ORB_CY,
  ORB_R,
  ORB_SIZES,
  orbLabel,
  PULSE_VELOCITY,
  ringCenters,
  targetDistance,
  thinkingOffset,
  type OrbSize,
} from "./geometry";
import { useOrbState, type OrbMode } from "./orb-store";

export interface TwinOrbProps {
  size: OrbSize;
  /** 0..1; defaults to the global orb store */
  readiness?: number;
  mode?: OrbMode;
  decorative?: boolean;
  className?: string;
}

/**
 * The twin orb (UI/UX plan §5): ring A = you (ink), ring B = your twin (rose); the rose-gold
 * lens is their overlap. Only SVG attributes animate (motion values → no React re-renders),
 * and the frame loop pauses when hidden, off-screen, or under reduced motion.
 */
export function TwinOrb({ size, readiness, mode, decorative = false, className }: TwinOrbProps) {
  const store = useOrbState();
  const r = readiness ?? store.readiness;
  const activeMode = mode ?? store.mode;
  const reduced = useReducedMotion();
  const target = targetDistance(r, activeMode === "listening");

  const distance = useMotionValue(reduced ? target : targetDistance(0));
  const radius = useMotionValue(ORB_R);
  const wobbleX = useMotionValue(0);
  const wobbleY = useMotionValue(0);

  const ax = useTransform(distance, (d) => ringCenters(d).ax);
  const bx = useTransform([distance, wobbleX], ([d, w]) => ringCenters(d as number).bx + (w as number));
  const by = useTransform(wobbleY, (w) => ORB_CY + w);

  // Spring toward the target distance whenever readiness / listening changes.
  useEffect(() => {
    if (reduced) {
      distance.jump(target);
      return;
    }
    const c = animate(distance, target, springs.orb);
    return () => c.stop();
  }, [target, reduced, distance]);

  // Impulses from the global store: a match pulls together, a miss knocks apart.
  const lastPulse = useRef(store.pulseKey);
  const lastMiss = useRef(store.missKey);
  useEffect(() => {
    if (store.pulseKey === lastPulse.current) return;
    lastPulse.current = store.pulseKey;
    if (!reduced) animate(distance, target, { ...springs.orb, velocity: PULSE_VELOCITY });
  }, [store.pulseKey, reduced, distance, target]);
  useEffect(() => {
    if (store.missKey === lastMiss.current) return;
    lastMiss.current = store.missKey;
    if (!reduced) animate(distance, target, { ...springs.orb, velocity: MISS_VELOCITY });
  }, [store.missKey, reduced, distance, target]);

  // Breathing + thinking orbit: a rAF loop that only runs while visible.
  const svgRef = useRef<SVGSVGElement>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(Boolean(e?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !onScreen) {
      radius.set(ORB_R);
      wobbleX.set(0);
      wobbleY.set(0);
      return;
    }
    let raf = 0;
    const tick = (t: number) => {
      if (!document.hidden) {
        radius.set(idleRadius(t));
        const o = activeMode === "thinking" ? thinkingOffset(t) : { dx: 0, dy: 0 };
        wobbleX.set(o.dx);
        wobbleY.set(o.dy);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, onScreen, activeMode, radius, wobbleX, wobbleY]);

  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const width = ORB_SIZES[size];

  return (
    <svg
      ref={svgRef}
      viewBox="-4 -4 108 72"
      width={width}
      height={(width * 72) / 108}
      className={cn("shrink-0 overflow-visible", className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": orbLabel(r) })}
    >
      <defs>
        <linearGradient id={`${id}-lens`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--lens-a)" />
          <stop offset="100%" stopColor="var(--lens-b)" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <m.circle cx={ax} cy={ORB_CY} r={radius} />
        </clipPath>
      </defs>
      {/* the shared lens: your twin's ring clipped by yours */}
      <m.circle cx={bx} cy={by} r={radius} fill={`url(#${id}-lens)`} clipPath={`url(#${id}-clip)`} />
      <m.circle cx={ax} cy={ORB_CY} r={radius} fill="none" stroke="var(--ink)" strokeWidth={2.2} />
      <m.circle cx={bx} cy={by} r={radius} fill="none" stroke="var(--twin-ink)" strokeWidth={2.2} />
    </svg>
  );
}
