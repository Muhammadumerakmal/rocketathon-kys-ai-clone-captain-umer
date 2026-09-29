"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string } | { kind: "error"; message: string };

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus({ kind: "sending" });
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setStatus(error ? { kind: "error", message: error.message } : { kind: "sent", email });
  }

  if (status.kind === "sent") {
    return (
      <p className="text-sm" role="status">
        Check <strong>{status.email}</strong> for your sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="email">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        placeholder="you@example.com"
      />
      <Button type="submit" className="w-full" disabled={status.kind === "sending"}>
        {status.kind === "sending" ? "Sending…" : "Email me a link"}
      </Button>
      {status.kind === "error" && (
        <p className="text-sm text-danger" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
