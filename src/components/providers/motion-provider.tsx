"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { dur, ease } from "@/lib/motion/tokens";

/**
 * Global motion setup (UI/UX plan §3.1): LazyMotion keeps Motion ≈5 KB instead of ≈34 KB;
 * `strict` forces `m.*` components. reducedMotion="user" drops transform/layout animations
 * for people who asked for less motion (opacity stays).
 * Screens that need drag/layout (Train, Memories) load `domMax` locally.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: dur.med, ease: ease.out }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
