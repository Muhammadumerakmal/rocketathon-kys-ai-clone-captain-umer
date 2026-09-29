"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export function DeleteEverything() {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "done" | "error">("idle");

  async function onDelete() {
    setState("deleting");
    // a network failure must not leave the button stuck on "Deleting…"
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: typed }),
    }).catch(() => null);
    if (res?.ok) {
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
      <div className="flex flex-wrap gap-2">
        <Input
          id="confirm-delete"
          name="confirm-delete"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-invalid={state === "error" || undefined}
          className="min-w-0 flex-1 basis-40 font-mono tracking-wide"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="DELETE"
        />
        <Button variant="danger" loading={state === "deleting"} disabled={typed !== "DELETE"} onClick={onDelete}>
          Delete everything
        </Button>
      </div>
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          Deletion failed — nothing was removed. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
