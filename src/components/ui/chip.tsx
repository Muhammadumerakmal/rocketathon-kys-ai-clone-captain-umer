"use client";

import type { VariantProps } from "class-variance-authority";
import { m } from "motion/react";
import type { ComponentProps } from "react";
import { pop } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { chipVariants } from "./chip-variants";

type ChipProps = Omit<ComponentProps<"span">, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> &
  VariantProps<typeof chipVariants> & { popIn?: boolean };

/** Chip with an optional "pop" entrance (plan §3.3 "Habit learned", pivotal badges). */
export function Chip({ className, tone, popIn, children, ...props }: ChipProps) {
  if (popIn) {
    return (
      <m.span className={cn(chipVariants({ tone }), className)} {...pop} {...props}>
        {children}
      </m.span>
    );
  }
  return (
    <span className={cn(chipVariants({ tone }), className)} {...props}>
      {children}
    </span>
  );
}
