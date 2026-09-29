"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ConnectionToggle({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch("/api/connectors", { method: connected ? "DELETE" : "POST" });
    router.refresh();
    setBusy(false);
  }

  return (
    <Button size="sm" variant={connected ? "secondary" : "primary"} onClick={toggle} disabled={busy}>
      {busy ? "…" : connected ? "Disconnect" : "Connect"}
    </Button>
  );
}
