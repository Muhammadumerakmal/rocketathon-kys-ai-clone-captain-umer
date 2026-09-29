"use client";

import { m, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TwinOrb } from "@/components/twin-orb/twin-orb";
import { buttonVariants } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip-variants";
import { ease } from "@/lib/motion/tokens";

const SEEN_KEY = "twinos-welcome-played";

// Whether the entrance already played this browser session. Read once, then stable.
let seenAtLoad: boolean | null = null;
function seenSnapshot(): boolean {
  if (seenAtLoad === null) {
    try {
      seenAtLoad = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {
      seenAtLoad = false;
    }
  }
  return seenAtLoad;
}
const noSubscribe = () => () => {};

/**
 * Welcome (UI/UX plan §6.1): the single orchestrated entrance — headline echo slides in,
 * orb rings drift together, three chips appear in sequence (≈560 ms total).
 * Plays once per browser session; tap anywhere to skip. No layout shift: every element is
 * rendered from the start and only opacity/transform animate.
 */
export function WelcomeHero({ ctaHref }: { ctaHref: string }) {
  const reduced = useReducedMotion();
  // Server snapshot says "seen" → no animation in SSR HTML, so hydration never mismatches.
  const seen = useSyncExternalStore(noSubscribe, seenSnapshot, () => true);
  const [skipped, setSkipped] = useState(false);
  const play = !seen && !reduced && !skipped;

  useEffect(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked: the entrance simply plays again next time
    }
  }, []);

  const enter = (delay: number) =>
    play ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.28, ease: ease.out, delay } } : {};

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-[18px] py-10 text-center min-[920px]:py-20" onPointerDown={() => setSkipped(true)}>
      {/* the orb springs from far apart to this readiness on mount: rings drift together */}
      <TwinOrb size="xl" readiness={0.55} />

      <h1 className="relative mt-8 font-display text-[clamp(44px,13vw,92px)] font-extrabold leading-[0.95] tracking-[-0.035em]">
        {/* the echo: a rose copy of the headline slides out from behind it */}
        <m.span
          aria-hidden
          className="absolute inset-0 text-twin-soft"
          initial={play ? { x: 0, y: 0, opacity: 0 } : false}
          animate={{ x: 6, y: 6, opacity: 1 }}
          transition={{ duration: 0.56, ease: ease.out }}
        >
          Meet your twin.
        </m.span>
        <span className="relative">Meet your twin.</span>
      </h1>

      <m.p className="mt-5 max-w-xl text-lg text-muted" {...enter(0.12)}>
        Train an AI on how you decide, then watch it predict your choices — scored every time against a stranger who knows nothing about you.
      </m.p>

      <div className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Who's who">
        {[
          { tone: "you" as const, label: "You" },
          { tone: "twin" as const, label: "Your twin" },
          { tone: "stranger" as const, label: "A stranger" },
        ].map((c, i) => (
          <m.span key={c.label} className={chipVariants({ tone: c.tone })} {...enter(0.24 + i * 0.1)}>
            {c.label}
          </m.span>
        ))}
      </div>

      <m.div className="mt-8" {...enter(0.5)}>
        <Link href={ctaHref} className={buttonVariants({ size: "lg" })}>
          Start training
        </Link>
      </m.div>
      <p className="mt-4 max-w-md text-xs text-faint">It&apos;s an AI, not you, and it can be wrong. You stay in control of every memory and every decision.</p>
    </div>
  );
}
