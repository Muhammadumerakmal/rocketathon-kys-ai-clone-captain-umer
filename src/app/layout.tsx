import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/ui/toaster";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

// Self-hosted at build time by next/font: no layout shift, no runtime request to Google.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display-face", display: "swap" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: { default: "TwinOS", template: "%s · TwinOS" },
  description: "Train an AI twin that provably understands how you decide — and shows its work.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f3f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e22" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // An explicit choice (cookie) is rendered server-side → no flash of the wrong theme.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en" data-theme={theme ?? undefined} className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
