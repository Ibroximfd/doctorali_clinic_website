/**
 * Local record of which orders a receipt print was *attempted* for.
 *
 * The browser cannot know whether paper actually came out (closing a dialog is
 * not proof), so only the attempt is tracked — enough for the orders list to
 * flag a sale whose receipt was never sent to the printer at all. Nothing is
 * reported to the backend.
 */
const KEY = "receipt_print_attempted_v1";

/**
 * Oldest entries are dropped past this cap so storage never grows unbounded.
 * 500 orders is far beyond the horizon reception scrolls back to, and older
 * ones simply show as "not printed" again.
 */
const MAX_ENTRIES = 500;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

export function readAttempted(): Set<string> {
  return new Set(read());
}

export function markAttempted(orderId: string): void {
  try {
    const list = read();
    if (list.includes(orderId)) return;
    list.push(orderId);
    const trimmed = list.length > MAX_ENTRIES ? list.slice(-MAX_ENTRIES) : list;
    window.localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* A print flag that cannot be stored is not worth failing the print over. */
  }
}
