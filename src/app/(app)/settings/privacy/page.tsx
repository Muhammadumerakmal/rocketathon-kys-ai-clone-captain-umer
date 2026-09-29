import { Download, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DeleteEverything } from "@/features/privacy/danger-zone";
import { requireViewer } from "@/lib/auth";
import { mockState } from "@/lib/mock/store";
import { CONSENT_VERSION } from "@/server/repos/profiles";

export const metadata: Metadata = { title: "Privacy" };

/** Privacy & Twin Passport (plan §15, F12, F13). */
export default async function PrivacyPage() {
  const viewer = await requireViewer();
  const sealed =
    viewer.mode === "mock"
      ? mockState().memories.filter((m) => m.influence === "sealed").length
      : ((await viewer.supabase.from("memories").select("id", { count: "exact", head: true }).eq("influence", "sealed")).count ?? 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Privacy &amp; control</h1>
        <p className="mt-1 text-sm text-muted">Your twin is yours. Here&apos;s everything you can see, take, and erase.</p>
      </header>

      <Card className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden /> Consent
        </CardTitle>
        <CardDescription>
          You agreed to consent version <strong>{viewer.mode === "live" ? (viewer.profile.consentVersion ?? "—") : CONSENT_VERSION}</strong>. If the terms change, you&apos;ll be asked again.
          TwinOS only models you, never other people, and never acts for you without approval.
        </CardDescription>
      </Card>

      <Card className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" aria-hidden /> Sealed memories
        </CardTitle>
        <CardDescription>
          {sealed} sealed {sealed === 1 ? "memory is" : "memories are"} stored for you only. They have no embedding and are never sent to any AI model.
        </CardDescription>
        <Link href="/memories" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          Manage memories
        </Link>
      </Card>

      <Card className="space-y-2">
        <CardTitle className="flex items-center gap-2">
          <Download className="size-4" aria-hidden /> Twin Passport
        </CardTitle>
        <CardDescription>Download every row TwinOS holds about you as JSON. AI-generated items are labelled as such.</CardDescription>
        <a href="/api/export" className={buttonVariants({ size: "sm" })} download>
          Download my data
        </a>
      </Card>

      <Card className="space-y-3 border-danger/40">
        <CardTitle className="text-danger">Delete everything</CardTitle>
        <CardDescription>
          Erases your account and every memory, prediction and answer. A receipt with no personal content is kept to prove the deletion happened.
        </CardDescription>
        <DeleteEverything />
      </Card>
    </div>
  );
}
