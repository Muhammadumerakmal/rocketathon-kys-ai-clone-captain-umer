"use client";

import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type KeyboardEvent, type MouseEvent } from "react";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";
import { activeTabIndex, TABS } from "./nav-items";
import { useViewTransitionNav } from "./use-view-transition-nav";

/**
 * Primary tabs with a sliding pill (UI/UX plan §3.3 "Tab change", §4 TabBar).
 * Horizontal = phone bottom bar; vertical = desktop rail. Arrow keys move focus.
 */
export function TabNav({ orientation, badge }: { orientation: "horizontal" | "vertical"; badge?: Record<string, boolean> }) {
  const pathname = usePathname();
  const active = activeTabIndex(pathname);
  const navigate = useViewTransitionNav();
  const refs = useRef<(HTMLAnchorElement | null)[]>([]);
  const horizontal = orientation === "horizontal";

  function onKeyDown(e: KeyboardEvent) {
    const keys = horizontal ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
    const i = refs.current.findIndex((el) => el === document.activeElement);
    if (i < 0 || !keys.includes(e.key)) return;
    e.preventDefault();
    const next = (i + (e.key === keys[1] ? 1 : -1) + TABS.length) % TABS.length;
    refs.current[next]?.focus();
  }

  function onClick(e: MouseEvent, href: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let new-tab clicks through
    e.preventDefault();
    navigate(href);
  }

  return (
    <nav aria-label="Main" onKeyDown={onKeyDown} className={cn("relative", horizontal ? "flex" : "flex flex-col gap-1")}>
      {active >= 0 && (
        <m.span
          aria-hidden
          className={cn("absolute rounded-full bg-surface-2", horizontal ? "inset-y-1.5 left-0 w-1/5" : "inset-x-0 top-0 h-11")}
          initial={false}
          animate={
            horizontal
              ? { x: `${active * 100}%`, scaleX: [1, 1.18, 1] }
              : { y: active * 48, scaleY: [1, 1.12, 1] }
          }
          transition={{ default: springs.bouncy, scaleX: { duration: 0.56 }, scaleY: { duration: 0.56 } }}
        />
      )}
      {TABS.map(({ href, label, icon: Icon }, i) => {
        const current = i === active;
        return (
          <Link
            key={href}
            ref={(el) => {
              refs.current[i] = el;
            }}
            href={href}
            onClick={(e) => onClick(e, href)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "relative z-10 flex items-center rounded-full text-sm font-semibold transition-colors",
              horizontal ? "min-h-14 flex-1 flex-col justify-center gap-0.5 text-[11px]" : "h-11 gap-3 px-4",
              current ? "text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span className="relative">
              <Icon className={horizontal ? "size-5" : "size-[18px]"} strokeWidth={1.8} aria-hidden />
              {badge?.[href] && <span className="absolute -right-1 -top-0.5 size-2 rounded-full bg-twin ring-2 ring-surface" aria-label="needs attention" />}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
