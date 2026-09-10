import { env } from "@/config/env";

/**
 * Sends a receipt to the printer.
 *
 * ```
 * Browser ──POST {receipt}──► http://localhost:9110/print ──ESC/POS──► printer
 * ```
 *
 * The receipt is the backend payload passed through **untouched** — the app
 * never parses or reshapes it, so a change to the receipt layout is an agent
 * concern only and never needs a front-end release.
 *
 * Deliberately plain `fetch`, NOT the app's HTTP client: that one carries the
 * reception API's base URL, the Bearer token and the refresh interceptor, all
 * of which would be wrong (and unsafe) against a service on localhost.
 *
 * Mixed content: the site is HTTPS and the agent is plain HTTP, but browsers
 * treat `http://localhost` as a potentially-trustworthy origin and allow it.
 */

/** A print failure carrying a short Uzbek message safe to show the desk. */
export class ReceiptPrintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptPrintError";
  }
}

const CONNECT_TIMEOUT_MS = 3_000;
/** A real print (feed + cut) can take a moment. */
const PRINT_TIMEOUT_MS = 10_000;

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

export async function printReceipt(receipt: Record<string, unknown>): Promise<void> {
  const { signal, done } = withTimeout(PRINT_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${env.printAgentUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt }),
      signal,
    });
  } catch (error) {
    // No HTTP response at all — the agent isn't reachable.
    throw new ReceiptPrintError(
      error instanceof DOMException && error.name === "AbortError"
        ? "Printer javob bermadi"
        : "Print-agent ishlamayapti (kassada ishga tushmagan)",
    );
  } finally {
    done();
  }

  if (response.ok) return;

  // The agent answered but not with 200 — surface its own message when present.
  let message = `Chek chiqmadi (xatolik ${response.status})`;
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error !== "") message = body.error;
  } catch {
    /* keep the status-based message */
  }
  throw new ReceiptPrintError(message);
}

/**
 * True when the agent (and its printer) answer a health probe. Lets the UI warn
 * "printer tayyor emas" before an order is even taken.
 */
export async function isPrinterReady(): Promise<boolean> {
  const { signal, done } = withTimeout(CONNECT_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.printAgentUrl}/health`, { signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    done();
  }
}
