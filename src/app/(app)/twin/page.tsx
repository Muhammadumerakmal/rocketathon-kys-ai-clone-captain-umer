import type { Metadata } from "next";
import { TwinChat } from "@/features/twin/twin-chat";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Twin" };

export default async function TwinPage() {
  const viewer = await requireViewer();
  return (
    <div className="space-y-3">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your twin</h1>
        <p className="text-sm text-muted">An AI model of your stated patterns — not you. You make the decisions.</p>
      </header>
      <TwinChat twinName={viewer.displayName} />
    </div>
  );
}
