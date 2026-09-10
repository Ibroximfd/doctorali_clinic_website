import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/**
 * Outcome of the most recent contact attempt.
 *
 * `pending` is the synthetic "never contacted" state the backend reports when
 * no follow-up record exists yet.
 */
export const FOLLOWUP_STATUSES = [
  "pending",
  "contacted",
  "not_interested",
  "ordered",
  "no_answer",
] as const;

export type FollowupStatus = (typeof FOLLOWUP_STATUSES)[number];

export function parseFollowupStatus(raw: unknown): FollowupStatus {
  return FOLLOWUP_STATUSES.includes(raw as FollowupStatus)
    ? (raw as FollowupStatus)
    : "pending";
}

export const FOLLOWUP_STATUS_LABEL: Readonly<Record<FollowupStatus, string>> = {
  pending: "Kutilmoqda",
  contacted: "Bog'lanildi",
  not_interested: "Qiziqmadi",
  ordered: "Qayta buyurtma",
  no_answer: "Ko'tarmadi",
};

/** Statuses reception can assign after a call — `pending` is never chosen. */
export const SELECTABLE_FOLLOWUP_STATUSES: readonly FollowupStatus[] = [
  "contacted",
  "ordered",
  "no_answer",
  "not_interested",
];

/**
 * Preset "at least N days since the last purchase" buckets.
 *
 * Semantics are **"N days or more"**, not an exact window — for an exact range
 * the API takes `days_from`/`days_to` instead.
 */
export const FOLLOWUP_PERIODS = ["1w", "2w", "1m", "1.5m", "2m", "3m"] as const;
export type FollowupPeriod = (typeof FOLLOWUP_PERIODS)[number];

export const FOLLOWUP_PERIOD_LABEL: Readonly<Record<FollowupPeriod, string>> = {
  "1w": "1 hafta",
  "2w": "2 hafta",
  "1m": "1 oy",
  "1.5m": "1.5 oy",
  "2m": "2 oy",
  "3m": "3 oy",
};

/** Default bucket shown on entry (30+ kun). */
export const DEFAULT_FOLLOWUP_PERIOD: FollowupPeriod = "1m";

/** Sort options, mapped to DRF `ordering` values. */
export const FOLLOWUP_ORDERINGS = [
  { value: "-days_ago", label: "Eng eski xarid" },
  { value: "days_ago", label: "Eng yangi xarid" },
  { value: "-total_spent", label: "Ko'p xarajat qilgan" },
  { value: "-orders_count", label: "Ko'p marta olgan" },
] as const;

/** Default: oldest purchase first — most overdue for a call at the top. */
export const DEFAULT_FOLLOWUP_ORDERING = "-days_ago";

export interface FollowupClientRef {
  readonly id: number;
  readonly fullName: string;
  readonly phone: string;
  readonly avatarUrl: string | null;
}

/**
 * The client's most recent showroom purchase — the anchor the "days ago"
 * reminder is computed from, server-side and in real time.
 */
export interface FollowupLastOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly date: TashkentDate;
  /** Whole days since this purchase — the headline metric on each card. */
  readonly daysAgo: number;
  readonly totalAmount: number;
  /** Human summary of what was bought, e.g. `Alatoo x2, Omega-3 x1`. */
  readonly itemsSummary: string;
}

export interface FollowupGiftStatus {
  readonly deliveredOrders: number;
  readonly ordersUntilGift: number;
  readonly giftAvailable: boolean;
  readonly message: string;
}

/** Last-contact state embedded in a row (and returned by the contact endpoint). */
export interface FollowupInfo {
  readonly status: FollowupStatus;
  readonly lastContactedAt: TashkentDate | null;
  readonly note: string;
}

export const PENDING_FOLLOWUP: FollowupInfo = {
  status: "pending",
  lastContactedAt: null,
  note: "",
};

/**
 * One row of the follow-up list: a client with their latest purchase, doctor,
 * loyalty totals and last-contact state. Each client appears once, keyed by
 * their most recent order.
 */
export interface FollowupEntry {
  readonly client: FollowupClientRef;
  readonly lastOrder: FollowupLastOrder;
  readonly doctor: { id: string; fullName: string; specialty: string } | null;
  readonly ordersCount: number;
  readonly totalSpent: number;
  readonly giftStatus: FollowupGiftStatus | null;
  readonly followup: FollowupInfo;
}

/** One past contact attempt (newest first in the history list). */
export interface FollowupHistoryEntry {
  readonly status: FollowupStatus;
  readonly statusDisplay: string;
  readonly note: string;
  /** Who made the call; may be empty. */
  readonly contactedByName: string;
  readonly contactedAt: TashkentDate;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseFollowupInfo(raw: unknown): FollowupInfo {
  if (!isRecord(raw)) return PENDING_FOLLOWUP;
  const contacted = str(raw.last_contacted_at);
  return {
    status: parseFollowupStatus(raw.status),
    lastContactedAt: contacted === "" ? null : tashkentFromApi(contacted),
    note: str(raw.note),
  };
}

export function parseFollowupEntry(raw: unknown): FollowupEntry {
  const e = (raw ?? {}) as Record<string, unknown>;
  const client = isRecord(e.client) ? e.client : {};
  const lastOrder = isRecord(e.last_order) ? e.last_order : {};
  const doctor = isRecord(e.doctor) ? e.doctor : null;
  const gift = isRecord(e.gift_status) ? e.gift_status : null;

  return {
    client: {
      id: num(client.id),
      fullName: str(client.full_name),
      phone: str(client.phone),
      avatarUrl:
        typeof client.avatar_url === "string"
          ? client.avatar_url
          : typeof client.photo === "string"
            ? client.photo
            : null,
    },
    lastOrder: {
      id: str(lastOrder.id),
      orderNumber: str(lastOrder.order_number),
      date: tashkentFromApi(str(lastOrder.date)),
      daysAgo: num(lastOrder.days_ago),
      totalAmount: num(lastOrder.total_amount),
      itemsSummary: str(lastOrder.items_summary),
    },
    doctor: doctor
      ? {
          id: str(doctor.id),
          fullName: str(doctor.full_name),
          specialty: str(doctor.specialty),
        }
      : null,
    ordersCount: num(e.orders_count),
    totalSpent: num(e.total_spent),
    giftStatus: gift
      ? {
          deliveredOrders: num(gift.delivered_orders),
          ordersUntilGift: num(gift.orders_until_gift),
          giftAvailable: gift.gift_available === true,
          message: str(gift.message),
        }
      : null,
    followup: parseFollowupInfo(e.followup),
  };
}

export function parseFollowupHistoryEntry(raw: unknown): FollowupHistoryEntry {
  const h = (raw ?? {}) as Record<string, unknown>;
  const by = isRecord(h.contacted_by) ? h.contacted_by : {};
  const status = parseFollowupStatus(h.status);
  return {
    status,
    statusDisplay: str(h.status_display, FOLLOWUP_STATUS_LABEL[status]),
    note: str(h.note),
    contactedByName: str(by.full_name),
    contactedAt: tashkentFromApi(str(h.contacted_at)),
  };
}
