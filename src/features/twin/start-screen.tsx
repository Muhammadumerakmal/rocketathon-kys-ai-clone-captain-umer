"use client";

import { Briefcase, CalendarPlus, Heart, PiggyBank, Sparkles } from "lucide-react";
import { TwinOrb } from "@/components/twin-orb/twin-orb";

export interface Starter {
  icon: typeof Sparkles;
  label: string;
  prompt: string;
  predict: boolean;
}

const STARTERS: Starter[] = [
  { icon: Briefcase, label: "Paid safe job or dream internship?", prompt: "Take a paid, safe job at a bank, or an unpaid internship at my dream design studio?", predict: true },
  { icon: PiggyBank, label: "Save the bonus or spend it?", prompt: "I got a surprise bonus. Save it or spend it on a course?", predict: true },
  { icon: Heart, label: "What matters most to me right now?", prompt: "What matters most to me right now?", predict: false },
  { icon: CalendarPlus, label: "Block focus time tomorrow", prompt: "Block 45 minutes tomorrow morning to prep", predict: false },
];

/** Empty state (UI/UX plan §12): orb + one sentence + starter prompts. */
export function StartScreen({ onPick }: { onPick: (s: Starter) => void }) {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <TwinOrb size="lg" />
      <h2 className="mt-5 font-display text-[clamp(26px,7vw,36px)] font-bold">What are you deciding?</h2>
      <p className="mt-1 text-muted">Try one of these, or type your own choice below.</p>
      <div className="mt-6 grid w-full gap-2 min-[640px]:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s)}
            className="flex min-h-14 items-center gap-3 rounded-[var(--r-md)] border border-line bg-surface px-4 text-left text-[15px] font-medium transition-transform hover:border-ink/40 active:scale-[0.98]"
          >
            <s.icon className="size-5 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
            <span className="flex-1">{s.label}</span>
            {s.predict && <Sparkles className="size-4 text-twin" aria-label="prediction" />}
          </button>
        ))}
      </div>
    </div>
  );
}
