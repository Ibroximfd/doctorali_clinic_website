import { endpoints } from "@/shared/lib/api/endpoints";
import { ApiError } from "@/shared/lib/api/errors";
import { http } from "@/shared/lib/api/http";

/**
 * Fetches the printable receipt payload for an existing order.
 *
 * Returned **untouched** — the print-agent, not the app, understands its shape.
 * The backend returns the same payload every time, so a reprint carries the
 * original receipt number.
 */
export async function fetchReceipt(
  orderId: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const data = await http.get<Record<string, unknown>>(endpoints.orderReceipt(orderId), {
    signal,
  });
  const receipt = data?.receipt;
  if (typeof receipt !== "object" || receipt === null) {
    throw new ApiError({
      code: "server_error",
      message: "Chek ma'lumoti olinmadi",
    });
  }
  return receipt as Record<string, unknown>;
}
