import { CONFIRM_PIN_HEADER, endpoints } from "@/shared/lib/api/endpoints";
import { http } from "@/shared/lib/api/http";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import { parseDailyClosing, type DailyClosingReport } from "../types/daily-closing";
import { parseReceptionAlerts, type ReceptionAlert } from "../types/reception-alert";

/**
 * `GET alerts/` — what needs attention right now.
 *
 * **Never throws.** The dashboard must render even when this endpoint is
 * unavailable: signals are an aid, not the dashboard, so a failure yields an
 * empty list and the card simply doesn't appear.
 */
export async function fetchAlerts(signal?: AbortSignal): Promise<ReceptionAlert[]> {
  try {
    const raw =
      (await http.get<Record<string, unknown>>(endpoints.alerts, {
        signal,
      })) ?? {};
    return parseReceptionAlerts(raw.results ?? raw.alerts);
  } catch {
    return [];
  }
}

/**
 * `GET alerts/daily/?date=` — the end-of-shift report.
 *
 * A date reads an earlier day, to reprint it or to close it late; omitting it
 * is today.
 */
export function fetchDailyClosing(
  date?: TashkentDate | null,
  signal?: AbortSignal,
): Promise<DailyClosingReport> {
  return http
    .get<unknown>(endpoints.alertsDaily, {
      query: date ? { date: ymd(date) } : undefined,
      signal,
    })
    .then(parseDailyClosing);
}

/**
 * `POST alerts/daily/close/` — signs the day off with the cash actually counted
 * in the drawer.
 *
 * The close response carries only the handover fields, so the day is read once
 * more rather than stitched together here. The PIN is needed only to close a
 * day a second time; sending a verified one otherwise is harmless and saves a
 * round trip when it turns out to be required.
 */
export async function closeDay(input: {
  date: TashkentDate;
  countedCash: number;
  note?: string;
  confirmPin?: string | null;
}): Promise<DailyClosingReport> {
  await http.post(endpoints.alertsDailyClose, {
    json: {
      date: ymd(input.date),
      counted_cash: input.countedCash,
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    },
    headers: input.confirmPin ? { [CONFIRM_PIN_HEADER]: input.confirmPin } : undefined,
  });
  return fetchDailyClosing(input.date);
}

/** `GET alerts/daily/export/` — the server-rendered handover sheet. */
export function exportDailyClosing(input: {
  date?: TashkentDate | null;
  format?: "pdf" | "xlsx";
}) {
  const format = input.format ?? "pdf";
  return http.blob(endpoints.alertsDailyExport, {
    query: {
      format,
      ...(input.date ? { date: ymd(input.date) } : {}),
    },
    fallbackFileName: `kunlik-hisobot.${format}`,
  });
}
