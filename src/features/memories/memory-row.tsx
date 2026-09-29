"use client";

import { ChevronDown, Eye, EyeOff, Lock, Trash2 } from "lucide-react";
import { animate, m, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from "motion/react";
import { useRef, useState } from "react";
import type { Memory, MemoryKind } from "@/contracts";
import { Chip } from "@/components/ui/chip";
import { tick } from "@/lib/haptics";
import { springs } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

export const SWIPE_THRESHOLD = 110;

export const KIND_LABEL: Record<MemoryKind, string> = {
  procedural: "Habit",
  value: "Value",
  goal: "Goal",
  episodic: "Moment",
  semantic: "Fact",
};

// Fixed locale + UTC: identical on server and client, and a "true since" date stored as UTC
// midnight shows the day the user picked in every time zone.
const dateFmt = new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/**
 * One memory (UI/UX plan §6.5): tap to expand; swipe right = mute / unmute, left = delete,
 * with a haptic tick at the 110px threshold. Every swipe action is also a visible button.
 */
export function MemoryRow({
  memory,
  focused,
  onToggleMute,
  onSeal,
  onDelete,
}: {
  memory: Memory;
  focused?: boolean;
  onToggleMute: () => void;
  onSeal: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(Boolean(focused));
  const x = useMotionValue(0);
  const past = memory.validTo !== null;
  const sealed = memory.influence === "sealed";
  const canSwipe = !past;

  // reveal colour behind the row while dragging
  const muteOpacity = useTransform(x, [0, 40, SWIPE_THRESHOLD], [0, 0.4, 1]);
  const deleteOpacity = useTransform(x, [-SWIPE_THRESHOLD, -40, 0], [1, 0.4, 0]);

  // haptic tick exactly when crossing the threshold, in either direction
  const armed = useRef<-1 | 0 | 1>(0);
  useMotionValueEvent(x, "change", (v) => {
    const zone = v >= SWIPE_THRESHOLD ? 1 : v <= -SWIPE_THRESHOLD ? -1 : 0;
    if (zone !== armed.current) {
      if (zone !== 0) tick();
      armed.current = zone;
    }
  });

  function onDragEnd(_: unknown, info: PanInfo) {
    const dx = info.offset.x;
    animate(x, 0, springs.snappy);
    if (dx >= SWIPE_THRESHOLD && !sealed) onToggleMute();
    else if (dx <= -SWIPE_THRESHOLD) onDelete();
  }

  return (
    <div className="relative overflow-hidden rounded-[var(--r-md)]">
      {canSwipe && (
        <>
          <m.div aria-hidden style={{ opacity: muteOpacity }} className="absolute inset-0 flex items-center bg-ink pl-5 text-sm font-semibold text-paper">
            {memory.influence === "muted" ? "Unmute" : sealed ? "Sealed" : "Mute"}
          </m.div>
          <m.div aria-hidden style={{ opacity: deleteOpacity }} className="absolute inset-0 flex items-center justify-end bg-danger pr-5 text-sm font-semibold text-paper">
            Delete
          </m.div>
        </>
      )}
      <m.div
        style={{ x }}
        drag={canSwipe ? "x" : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={onDragEnd}
        className={cn(
          "relative touch-pan-y border border-line bg-surface",
          sealed && "pattern-sealed",
          past && "opacity-70",
          focused && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
        )}
        style-view-transition-name={focused ? "morph" : undefined}
      >
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left">
          <span className="min-w-0 flex-1 space-y-1.5">
            <span className={cn("block break-words text-[15px]", past && "line-through decoration-faint")}>{memory.content}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <Chip className="text-xs">{KIND_LABEL[memory.kind]}</Chip>
              {sealed && <Chip className="text-xs">Sealed, never sent to the AI</Chip>}
              {memory.influence === "muted" && <Chip tone="warn" className="text-xs">Muted</Chip>}
              <span className="tabular-nums">
                {fmtDate(memory.validFrom)} → {memory.validTo ? fmtDate(memory.validTo) : "now"}
              </span>
            </span>
          </span>
          <ChevronDown className={cn("mt-1 size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>

        {/* expand: grid-template-rows 0fr → 1fr (plan §6.5) */}
        <div inert={!open} className={cn("grid transition-[grid-template-rows] duration-300 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1 border-t border-line px-2 py-1.5 text-sm">
              <span className="px-2 text-xs text-muted">
                From {memory.sourceType === "manual" ? "you" : memory.sourceType}
                {memory.supersededBy && " · replaced by a newer belief"}
              </span>
              <span className="ml-auto flex">
                {!past && !sealed && (
                  <RowAction label={memory.influence === "muted" ? "Unmute" : "Mute"} onClick={onToggleMute}>
                    {memory.influence === "muted" ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                  </RowAction>
                )}
                {!sealed && (
                  <RowAction label="Seal" onClick={onSeal}>
                    <Lock className="size-4" aria-hidden />
                  </RowAction>
                )}
                <RowAction label="Delete" onClick={onDelete} danger>
                  <Trash2 className="size-4" aria-hidden />
                </RowAction>
              </span>
            </div>
          </div>
        </div>
      </m.div>
    </div>
  );
}

function RowAction({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold hover:bg-surface-2", danger ? "text-danger" : "text-foreground")}
    >
      {children}
      {label}
    </button>
  );
}
