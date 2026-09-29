"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, SHIPPED_PHASE } from "./nav-items";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto md:flex-col">
      {NAV_ITEMS.map(({ href, label, icon: Icon, phase }) => {
        const shipped = phase <= SHIPPED_PHASE;
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const classes = cn(
          "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm",
          active ? "bg-primary/10 font-medium text-primary" : "text-muted",
          shipped ? "hover:bg-surface-2 hover:text-foreground" : "cursor-not-allowed opacity-50",
        );

        return shipped ? (
          <Link key={href} href={href} className={classes} aria-current={active ? "page" : undefined}>
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ) : (
          <span key={href} className={classes} title={`Coming in phase ${phase}`} aria-disabled>
            <Icon className="size-4" aria-hidden />
            {label}
          </span>
        );
      })}
    </nav>
  );
}
