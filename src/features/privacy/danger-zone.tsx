"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DeleteEverything() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "done" | "error">("idle");

  async function onDelete() {
    setState("deleting");
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    });
    if (res.ok) {
      setState("done");
      setTimeout(() => {
        router.replace("/");
        router.refresh(); // re-render server components with the cleared session
      }, 1500);
    } else setState("error");
  }

  if (state === "done") return <p className="text-sm" role="status">Everything is deleted. Goodbye 👋</p>;

  return (
    <div className="space-y-2">
      <label className="block text-sm" htmlFor="confirm-delete">
        Type <strong>DELETE</strong> to permanently erase your twin and every row about you.
      </label>
      <div className="flex gap-2">
        <input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm" autoComplete="off" />
        <Button variant="danger" size="sm" disabled={typed !== "DELETE" || state === "deleting"} onClick={onDelete}>
          {state === "deleting" ? "Deleting…" : "Delete everything"}
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          Deletion failed — nothing was removed. Try again.
        </p>
      )}
    </div>
  );
}
