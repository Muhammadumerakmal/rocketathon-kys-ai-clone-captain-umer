import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { href: "/settings/privacy", label: "Privacy" },
  { href: "/settings/connections", label: "Connections" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <nav aria-label="Settings" className="mx-auto flex max-w-2xl gap-2 border-b border-border">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-foreground">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
