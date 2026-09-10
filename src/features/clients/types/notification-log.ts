import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

/**
 * Delivery state of one message.
 *
 * `pending` is NOT an error — quiet hours (21:00–09:00) push the send to 09:00.
 * `skipped` means the client cannot be reached (no app, blocked, or opted out)
 * and the reason sits in `error` — reception's cue to pick up the phone.
 */
export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "skipped"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export function parseNotificationStatus(raw: unknown): NotificationStatus {
  return raw === "sent" || raw === "failed" || raw === "skipped" ? raw : "pending";
}

export const NOTIFICATION_STATUS_LABEL: Readonly<Record<NotificationStatus, string>> = {
  pending: "Kutilmoqda",
  sent: "Yuborildi",
  failed: "Xato",
  skipped: "Bormadi",
};

/** A message that never reached the client means reception should call. */
export function needsCall(status: NotificationStatus): boolean {
  return status === "failed" || status === "skipped";
}

/** One row of the client's "Yuborilgan xabarlar" history. */
export interface NotificationLog {
  readonly id: number;
  readonly templateCode: string;
  readonly channel: string;
  readonly channelDisplay: string;
  readonly title: string;
  readonly body: string;
  readonly status: NotificationStatus;
  readonly statusDisplay: string;
  /** Why a `skipped`/`failed` message didn't go — server text. */
  readonly error: string;
  readonly sentAt: TashkentDate | null;
  readonly createdAt: TashkentDate;
}

export function notificationStatusLabel(log: NotificationLog): string {
  return log.statusDisplay.trim() || NOTIFICATION_STATUS_LABEL[log.status];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseNotificationLog(raw: unknown): NotificationLog {
  const n = isRecord(raw) ? raw : {};
  return {
    id: typeof n.id === "number" ? n.id : Number(n.id ?? 0),
    templateCode: str(n.template_code),
    channel: str(n.channel),
    channelDisplay: str(n.channel_display),
    title: str(n.title),
    body: str(n.body),
    status: parseNotificationStatus(n.status),
    statusDisplay: str(n.status_display),
    error: str(n.error),
    sentAt:
      typeof n.sent_at === "string" && n.sent_at !== ""
        ? maybeTashkentFromApi(n.sent_at)
        : null,
    createdAt: tashkentFromApi(str(n.created_at)),
  };
}
