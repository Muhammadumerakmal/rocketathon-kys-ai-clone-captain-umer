import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PROMISES = [
  { title: "It knows you, not people in general", body: "Every prediction is scored against a stranger baseline. You see the lift." },
  { title: "Honest about uncertainty", body: "Confidence comes from agreement, evidence and your track record, never from a made-up number." },
  { title: "Shows real reasons", body: "Counterfactual checks find the memories that actually changed the answer." },
  { title: "You stay in control", body: "Mute or seal any memory. Export or delete everything in one click." },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      <p className="text-sm font-medium text-twin">TwinOS · human digital twin</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">
        Don&apos;t just chat with AI. Train one that provably understands how you think.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Researchers found AI “digital twins” barely beat a generic chatbot at predicting real people. TwinOS has to
        prove it beats a stranger — every time — and it shows its work.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/sign-in" className={buttonVariants({ size: "lg" })}>
          Create my twin
        </Link>
        <span className="text-sm text-muted">Your lift over a stranger is measured live, on your own decisions.</span>
      </div>

      <div className="mt-14 grid gap-4 sm:grid-cols-2">
        {PROMISES.map((p) => (
          <Card key={p.title}>
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 text-sm text-muted">{p.body}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
