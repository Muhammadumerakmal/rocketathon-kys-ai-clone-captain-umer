"use client";

import { useEffect } from "react";
import { orb } from "@/components/twin-orb/orb-store";

/** Seeds the global orb store with the server-known readiness (known dimensions / 8). */
export function OrbSync({ readiness }: { readiness: number }) {
  useEffect(() => {
    orb.setReadiness(readiness);
  }, [readiness]);
  return null;
}
