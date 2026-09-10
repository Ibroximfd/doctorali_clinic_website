"use client";

import { useEffect, useState } from "react";

/**
 * Delays a value until it stops changing.
 *
 * Every search field in this panel hits the network, and reception types fast —
 * without this, a five-letter name is five requests, four of them already stale
 * by the time they land.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
