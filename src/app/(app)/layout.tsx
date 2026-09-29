import Link from "next/link";
import type { ReactNode } from "react";
import { AppNav } from "@/components/shell/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-3rem)] max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <Link href="/" className="mb-4 block px-3 text-lg font-semibold tracking-tight">
          Twin<span className="text-twin">OS</span>
        </Link>
        <AppNav />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
