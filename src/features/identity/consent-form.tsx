"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptConsent, type ConsentState } from "./actions";

export function ConsentForm() {
  const [state, action, pending] = useActionState<ConsentState, FormData>(acceptConsent, {});

  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="agree" className="mt-1 size-4" required />
        <span>I understand TwinOS is an AI, it is not me, it can be wrong, and I make my own decisions.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="euUser" className="mt-1 size-4" />
        <span>I&apos;m in the EU (we&apos;ll label anything you export as AI-generated).</span>
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Saving…" : "I agree — start training my twin"}
      </Button>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
