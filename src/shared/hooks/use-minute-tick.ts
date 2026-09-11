"use client";

import { useSyncExternalStore } from "react";

/**
 * Re-renders once a minute while `enabled`, so a time-derived look — an
 * appointment whose slot has just come round — flips the moment the clock
 * reaches it instead of waiting for the next refetch.
 *
 * ONE interval for the whole page. Each row used to run its own timer, so a
 * queue of twenty visits woke React twenty separate times a minute, each a
 * separate render. Now every subscriber ticks on the same beat, in one commit.
 *
 * Callers pass `enabled: false` once the transition they were waiting for has
 * happened; a row already in its final state has nothing left to tick for.
 */
let tick = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  timer ??= setInterval(() => {
    tick += 1;
    for (const notify of listeners) notify();
  }, 60_000);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const noop = () => () => {};

export function useMinuteTick(enabled: boolean): void {
  useSyncExternalStore(
    enabled ? subscribe : noop,
    () => (enabled ? tick : 0),
    () => 0,
  );
}
