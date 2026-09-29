"use client";

import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/sheet";
import { getJson } from "@/lib/fetcher";

interface ThreadSummary {
  id: string;
  title: string;
  createdAt: string;
}

/** ChatKit-style thread history. Threads are stored in YOUR database (Ultra plan §4). */
export function HistorySheet({
  open,
  onClose,
  onOpenThread,
}: {
  open: boolean;
  onClose: () => void;
  onOpenThread: (id: string, messages: { role: "user" | "twin"; text: string }[]) => void;
}) {
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getJson<{ threads: ThreadSummary[] }>("/api/twin/threads")
      .then((r) => !cancelled && (setThreads(r.threads), setError(false)))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function openThread(id: string) {
    const r = await getJson<{ id: string; messages: { role: "user" | "twin"; text: string }[] }>(`/api/twin/threads/${id}`);
    onOpenThread(r.id, r.messages);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Conversations">
      {error ? (
        <p className="py-4 text-sm text-danger">Couldn&apos;t load your conversations.</p>
      ) : threads === null ? (
        <div className="space-y-2 py-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-[var(--r-md)] bg-surface-2" />
          ))}
        </div>
      ) : threads.length === 0 ? (
        <p className="py-4 text-sm text-muted">No conversations yet.</p>
      ) : (
        <ul className="max-h-[60dvh] space-y-1 overflow-y-auto py-1">
          {threads.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => openThread(t.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-[var(--r-md)] px-3 text-left hover:bg-surface-2"
              >
                <MessagesSquare className="size-4 shrink-0 text-muted" aria-hidden />
                <span className="flex-1 truncate text-[15px]">{t.title}</span>
                <time className="shrink-0 text-xs text-faint" dateTime={t.createdAt}>
                  {new Date(t.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
