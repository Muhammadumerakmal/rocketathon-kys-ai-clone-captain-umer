import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getViewer } from "@/lib/auth";
import { isMock } from "@/lib/env";
import { SignInForm } from "@/features/identity/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  await connection(); // the form depends on runtime mode, so never prerender it
  if (!isMock() && (await getViewer())) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Create or open your twin</h1>
      <p className="mt-2 text-sm text-muted">We&apos;ll email you a sign-in link. No password to remember.</p>
      <Card className="mt-6">
        {isMock() ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">Demo mode is on (no database). You&apos;ll explore as the demo persona Aria.</p>
            <Link href="/dashboard" className={buttonVariants({ className: "w-full" })}>
              Continue as Aria
            </Link>
          </div>
        ) : (
          <SignInForm />
        )}
      </Card>
      <p className="mt-4 text-xs text-muted">
        TwinOS models only you, from what you choose to share. It is an AI and can be wrong.
      </p>
    </main>
  );
}
