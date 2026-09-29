import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { ConsentForm } from "@/features/identity/consent-form";
import { getViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Consent" };

const POINTS = [
  ["What's stored", "Your quiz answers, the memories you add, your predictions and your feedback. Nothing is scraped; you choose everything."],
  ["What's sent to AI providers", "Relevant memories and your question are sent to OpenAI to generate answers. Sealed memories are never sent anywhere."],
  ["Your control", "Mute or seal any memory, export everything as JSON, or delete everything in one click from Settings."],
  ["It's an AI", "Your twin represents patterns from what you share. It is not you, it can be wrong, and it never acts for you without your approval."],
] as const;

/** Versioned consent (plan §15). Re-shown whenever CONSENT_VERSION changes. */
export default async function ConsentPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.mode === "live" && !viewer.profile.needsConsent) redirect("/train");

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-[clamp(30px,8vw,40px)] font-extrabold leading-[1.05]">Before we start</h1>
      <p className="mt-2 text-[15px] text-muted">Here&apos;s exactly what TwinOS does with your data.</p>
      <Card className="mt-6 space-y-4">
        <dl className="space-y-3">
          {POINTS.map(([title, body]) => (
            <div key={title}>
              <dt className="text-sm font-semibold">{title}</dt>
              <dd className="text-sm text-muted">{body}</dd>
            </div>
          ))}
        </dl>
        <ConsentForm />
      </Card>
    </main>
  );
}
