import { endpoints } from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http } from "@/shared/lib/api/http";

/** Outcome of checking a typed PIN. */
export type ConfirmPinResult =
  /** Right — the caller may go ahead and send its change. */
  | { readonly ok: true }
  /** Wrong PIN. Nothing was changed. */
  | { readonly ok: false; readonly kind: "invalid" }
  /** The server could not be asked. The caller shows `message` and stops. */
  | { readonly ok: false; readonly kind: "failed"; readonly message: string };

/**
 * Asks the server whether a PIN is right (`POST auth/verify-pin/`).
 *
 * The answers that matter:
 *  • **200** — accepted (a `{"valid": false}` body still counts as a refusal,
 *    for a backend that reports it that way instead of with a 400);
 *  • **400/401/403** — wrong PIN, or this account may not do this at all;
 *  • **429** — too many wrong attempts; the account is locked for a few minutes
 *    and the server's own message says so.
 *
 * A connection failure is NEVER treated as valid: the change is refused and the
 * desk sees why. There is no local fallback — the attempt counter is shared
 * with the `X-Confirm-Pin` header, so a PIN checked anywhere but the server
 * would be a way around the lockout.
 */
export async function verifyPin(pin: string): Promise<ConfirmPinResult> {
  try {
    const data = await http.post<{ valid?: boolean } | null>(endpoints.verifyPin, {
      json: { pin },
    });
    return data?.valid === false ? { ok: false, kind: "invalid" } : { ok: true };
  } catch (error) {
    if (ApiError.is(error)) {
      const status = error.status;
      if (status === 400 || status === 401 || status === 403) {
        return { ok: false, kind: "invalid" };
      }
      // 429 `pin_locked` included: the message names the wait, so it is shown
      // as-is rather than being reduced to "wrong PIN".
      return { ok: false, kind: "failed", message: error.message };
    }
    // An answer in a shape we can't read (an HTML error page from a proxy) must
    // still come back as an outcome — the dialog awaits this call, and a thrown
    // error would leave its button spinning for good.
    return {
      ok: false,
      kind: "failed",
      message: "PIN-kodni tekshirib bo'lmadi. Qayta urinib ko'ring",
    };
  }
}
