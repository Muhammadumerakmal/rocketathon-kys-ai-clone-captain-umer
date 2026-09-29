"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/field";
import { acceptConsent, type ConsentState } from "./actions";

export function ConsentForm() {
  const [state, action, pending] = useActionState<ConsentState, FormData>(acceptConsent, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <CheckboxField name="agree" required>
          I understand TwinOS is an AI, it is not me, it can be wrong, and I make my own decisions.
        </CheckboxField>
        <CheckboxField name="euUser" className="text-muted">
          I&apos;m in the EU (we&apos;ll label anything you export as AI-generated).
        </CheckboxField>
      </div>
      <Button type="submit" loading={pending} className="w-full">
        I agree — start training my twin
      </Button>
      {state.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
