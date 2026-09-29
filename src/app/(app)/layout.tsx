import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/shell/app-nav";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <Link href="/" className="mb-4 block px-3 text-lg font-semibold tracking-tight">
          Twin<span className="text-twin">OS</span>
        </Link>
        <AppNav />
        <div className="mt-6 hidden space-y-2 px-3 text-xs text-muted md:block">
          <p>
            Signed in as <span className="font-medium text-foreground">{viewer.displayName}</span>
          </p>
          {viewer.mode === "mock" && <Badge tone="warning">Demo mode</Badge>}
          <form action="/auth/sign-out" method="post">
            <button type="submit" className="underline-offset-2 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
