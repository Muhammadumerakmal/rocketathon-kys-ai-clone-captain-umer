import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TwinOS", template: "%s · TwinOS" },
  description: "Train an AI twin that provably understands how you decide — and shows its work.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh font-sans antialiased">
        {children}
        {/* EU AI Act Art. 50: users must know they're interacting with an AI (plan §15). */}
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          TwinOS is an AI. It represents patterns learned from information you choose to provide. It is not you,
          and it can be wrong. You make the decisions.
        </footer>
      </body>
    </html>
  );
}
