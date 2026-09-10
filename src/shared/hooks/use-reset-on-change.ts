"use client";

import { useState } from "react";

/**
 * Resets local state when `key` changes, during render.
 *
 * This is React's documented alternative to the "clear the form when the dialog
 * opens" effect: an effect for that runs a frame late, so the old values are
 * painted once before being wiped — and it costs a second render every time.
 * Adjusting during render, React re-runs the component before touching the DOM,
 * so nothing stale is ever shown.
 */
export function useResetOnChange<T>(key: T, reset: () => void): void {
  const [previous, setPrevious] = useState(key);
  if (!Object.is(previous, key)) {
    setPrevious(key);
    reset();
  }
}
