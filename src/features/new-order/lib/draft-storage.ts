/**
 * Persists the in-progress New Order form so a browser reload — or an
 * accidental tab close mid-order — no longer throws away everything reception
 * has typed.
 *
 * The storage is deliberately dumb: it moves an opaque JSON object in and out
 * plus a timestamp. Turning the form state into that object (and back) is the
 * store's job.
 */
const KEY = "new_order_draft_v1";
const SAVED_AT_KEY = "new_order_draft_saved_at_v1";

/**
 * A draft older than this is dropped rather than restored: it almost certainly
 * belongs to a previous shift, and silently resurrecting a day-old cart is
 * worse than starting clean.
 */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function readDraft(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;

    const savedAt = Date.parse(window.localStorage.getItem(SAVED_AT_KEY) ?? "");
    if (Number.isNaN(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
      clearDraft();
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // A draft written by an older build (or half-written during a crash) must
    // never wedge the form.
  }
  clearDraft();
  return null;
}

export function saveDraft(draft: Record<string, unknown>): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
    window.localStorage.setItem(SAVED_AT_KEY, new Date().toISOString());
  } catch {
    /* A form that cannot be persisted still works for this session. */
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(SAVED_AT_KEY);
  } catch {
    /* ignore */
  }
}
