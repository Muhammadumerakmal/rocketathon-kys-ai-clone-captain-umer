import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AiDisclosure } from "@/components/shared/ai-disclosure";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { Chip } from "@/components/ui/chip";
import { MORE } from "./nav-items";
import { OrbSync } from "./orb-sync";
import { TabNav } from "./tab-nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * App shell (UI/UX plan §4): sticky top bar, bottom tab bar on phones, left rail ≥ 920px.
 * Chrome has its own view-transition-name so it stays still while content slides.
 */
export function AppShell({
  children,
  readiness,
  pendingRevisions,
  demo,
  displayName,
}: {
  children: ReactNode;
  readiness: number;
  pendingRevisions: number;
  demo: boolean;
  displayName: string;
}) {
  const badge = { "/memories": pendingRevisions > 0 };

  return (
    <div className="min-h-dvh min-[920px]:grid min-[920px]:grid-cols-[15rem_1fr]">
      <OrbSync readiness={readiness} />

      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line px-4 py-6 min-[920px]:flex" style={{ viewTransitionName: "rail" }}>
        <Link href="/" className="flex items-center gap-2 px-2">
          <TwinOrb size="sm" decorative />
          <span className="font-display text-xl font-bold">TwinOS</span>
        </Link>
        <TabNav orientation="vertical" badge={badge} />
        <nav aria-label="More" className="flex flex-col gap-1 border-t border-line pt-4">
          {MORE.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex h-10 items-center gap-3 rounded-full px-4 text-sm text-muted hover:bg-surface-2 hover:text-foreground">
              <Icon className="size-4" strokeWidth={1.8} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2 px-2 text-xs text-muted">
          <p className="truncate">
            Signed in as <span className="font-semibold text-foreground">{displayName}</span>
          </p>
          <div className="flex items-center justify-between">
            {demo ? <Chip tone="neutral">Demo mode</Chip> : <span />}
            <ThemeToggle />
          </div>
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="min-h-11 hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Phone top bar */}
        <header
          className="scroll-condense sticky top-0 z-30 flex items-center justify-between bg-paper/90 px-[18px] py-2.5 backdrop-blur min-[920px]:hidden"
          style={{ viewTransitionName: "topbar" }}
        >
          <Link href="/" className="flex items-center gap-2">
            <TwinOrb size="sm" decorative />
            <span className="font-display text-lg font-bold">TwinOS</span>
          </Link>
          <div className="flex items-center">
            <ThemeToggle />
            <details className="relative">
              <summary className="grid size-11 cursor-pointer list-none place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="More">
                <Menu className="size-5" strokeWidth={1.8} aria-hidden />
              </summary>
              <div className="absolute right-0 top-12 w-52 rounded-[var(--r-md)] border border-line bg-surface p-1.5 shadow-[var(--shadow)]">
                {MORE.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-[var(--r-sm)] px-3 text-sm hover:bg-surface-2">
                    <Icon className="size-4" strokeWidth={1.8} aria-hidden />
                    {label}
                  </Link>
                ))}
                <form action="/auth/sign-out" method="post">
                  <button type="submit" className="flex min-h-11 w-full items-center gap-3 rounded-[var(--r-sm)] px-3 text-sm text-muted hover:bg-surface-2">
                    <LogOut className="size-4" strokeWidth={1.8} aria-hidden />
                    Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-[18px] pb-28 pt-4 min-[920px]:px-10 min-[920px]:pb-10 min-[920px]:pt-8">
          {children}
        </main>
        <AiDisclosure className="px-[18px] pb-24 min-[920px]:pb-6" />

        {/* Phone bottom tab bar */}
        <div
          className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-2 backdrop-blur min-[920px]:hidden"
          style={{ viewTransitionName: "tabbar" }}
        >
          <TabNav orientation="horizontal" badge={badge} />
        </div>
      </div>
    </div>
  );
}
