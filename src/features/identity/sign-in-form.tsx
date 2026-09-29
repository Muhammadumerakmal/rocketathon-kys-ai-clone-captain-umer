"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    try {
      const { error } = await createClient().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setStatus(error ? { kind: "error", message: `${error.message} Check the address and try again.` } : { kind: "sent", email });
    } catch {
      setStatus({ kind: "error", message: "Couldn't reach the sign-in service. Check your connection and try again." });
    }
  }

  if (status.kind === "sent") {
    return (
      <div className="space-y-2" role="status">
        <p className="text-[15px]">
          Check <strong className="break-all">{status.email}</strong> for your sign-in link.
        </p>
        <button type="button" onClick={() => setStatus({ kind: "idle" })} className="min-h-11 text-sm font-semibold text-muted underline-offset-4 hover:text-foreground hover:underline">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        required
        autoComplete="email"
        spellCheck={false}
        autoCapitalize="none"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-invalid={status.kind === "error" || undefined}
        aria-describedby={status.kind === "error" ? "email-error" : undefined}
        placeholder="you@example.com…"
      />
      <Button type="submit" className="w-full" loading={status.kind === "sending"}>
        Email Me a Link
      </Button>
      {status.kind === "error" && (
        <p id="email-error" className="text-sm text-danger" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
