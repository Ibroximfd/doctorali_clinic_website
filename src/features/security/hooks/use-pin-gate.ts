"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Runs an action behind the PIN dialog.
 *
 * The caller asks for a PIN, the dialog verifies it, and the pending action is
 * then replayed WITH that PIN so it can travel on as `X-Confirm-Pin`. Keeping
 * the pending action in a ref (rather than state) means opening the dialog
 * doesn't re-render the caller's tree mid-flight.
 */
export function usePinGate() {
  const [open, setOpen] = useState(false);
  const pending = useRef<((pin: string) => void) | null>(null);

  /** Opens the dialog; `action` runs with the verified PIN once it passes. */
  const requestPin = useCallback((action: (pin: string) => void) => {
    pending.current = action;
    setOpen(true);
  }, []);

  const handleConfirmed = useCallback((pin: string) => {
    const action = pending.current;
    pending.current = null;
    action?.(pin);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) pending.current = null;
    setOpen(next);
  }, []);

  return { open, requestPin, handleConfirmed, handleOpenChange } as const;
}
