"use client";

import { useEffect, useState } from "react";

/**
 * Re-renders once a minute while `enabled`, so a time-derived look — an
 * appointment whose slot has just come round — flips the moment the clock
 * reaches it instead of waiting for the next refetch.
 *
 * Callers pass `enabled: false` once the transition they were waiting for has
 * happened; a row already in its final state has nothing left to tick for.
 */
export function useMinuteTick(enabled: boolean): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
}
