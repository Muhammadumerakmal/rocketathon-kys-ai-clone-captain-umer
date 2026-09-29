"use client";

import { LazyMotion } from "motion/react";
import type { ReactNode } from "react";

const loadMax = () => import("@/lib/motion/features-max").then((m) => m.default);

/** Wrap a subtree that needs drag or layout animations; features load lazily. */
export function MotionMax({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMax} strict>
      {children}
    </LazyMotion>
  );
}
