"use client";

import { useReducedMotion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { directionTo } from "./nav-items";

/**
 * Stable view transitions (UI/UX plan §7): wrap router.push in document.startViewTransition.
 * Direction is set with data-dir on <html> (not transition *types*, which Firefox lacks).
 * The transition's update callback resolves once the new pathname has rendered.
 */
export function useViewTransitionNav() {
  const router = useRouter();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    pending.current?.();
    pending.current = null;
  }, [pathname]);

  return useCallback(
    (href: string) => {
      if (href === pathname) return;
      if (reduced || typeof document === "undefined" || !document.startViewTransition) {
        router.push(href);
        return;
      }
      document.documentElement.dataset.dir = directionTo(pathname, href);
      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            pending.current = resolve;
            router.push(href);
            // never hold the page hostage if navigation is slow
            setTimeout(resolve, 1200);
          }),
      );
    },
    [pathname, reduced, router],
  );
}
