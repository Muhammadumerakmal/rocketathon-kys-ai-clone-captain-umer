"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function ConnectionToggle({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/connectors", { method: connected ? "DELETE" : "POST" });
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      toast.error(`Couldn't ${connected ? "disconnect" : "connect"} the calendar. Check your connection and try again.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant={connected ? "secondary" : "primary"} onClick={toggle} loading={busy}>
      {connected ? "Disconnect" : "Connect"}
    </Button>
  );
}
