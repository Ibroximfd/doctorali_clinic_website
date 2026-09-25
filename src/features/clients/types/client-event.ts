import { maybeParseDoctorRef, type DoctorRef } from "@/features/doctors/types/doctor";
import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";
import { parseFilialRef, type FilialRef } from "@/shared/domain/filial";

/**
 * What happened, on a client's history feed.
 *
 * `unknown` is load-bearing: the backend adds kinds over time and an
 * unrecognised one must render as a neutral row rather than break the card.
 * That is safe precisely because the readable sentence arrives as `title` — the
 * app never composes it.
 */
export const CLIENT_EVENT_KINDS = [
  "client_created",
  "app_linked",
  "account_opened",
  "password_reset",
  "visit_scheduled",
  "visit_arrived",
  "visit_cancelled",
  "visit_no_show",
  "order_created",
  "order_cancelled",
  "treatment_done",
  "treatment_cancelled",
  "debt_created",
  "debt_payment",
  "debt_closed",
  "debt_overdue",
  "gift_granted",
  "contacted",
  "note_added",
  "tag_changed",
  "notification_sent",
  "merged",
  "blocked",
  "anonymized",
  "unknown",
] as const;
export type ClientEventKind = (typeof CLIENT_EVENT_KINDS)[number];

export function parseClientEventKind(raw: unknown): ClientEventKind {
  return CLIENT_EVENT_KINDS.includes(raw as ClientEventKind)
    ? (raw as ClientEventKind)
    : "unknown";
}

/**
 * The timeline chips reception filters by. Each maps to the set of raw kinds
 * the backend understands, so "Qarz" covers issue/payment/close/overdue in one
 * tap instead of four.
 */
export const CLIENT_EVENT_FILTERS = [
  "all",
  "orders",
  "visits",
  "treatments",
  "debts",
  "messages",
] as const;
export type ClientEventFilter = (typeof CLIENT_EVENT_FILTERS)[number];

export const CLIENT_EVENT_FILTER_LABEL: Readonly<Record<ClientEventFilter, string>> = {
  all: "Hammasi",
  orders: "Buyurtma",
  visits: "Tashrif",
  treatments: "Muolaja",
  debts: "Qarz",
  messages: "Xabar",
};

/** Raw `kind` values sent as repeated `kind=` params; empty for `all`. */
export const CLIENT_EVENT_FILTER_KINDS: Readonly<
  Record<ClientEventFilter, readonly string[]>
> = {
  all: [],
  orders: ["order_created", "order_cancelled"],
  visits: ["visit_scheduled", "visit_arrived", "visit_cancelled", "visit_no_show"],
  treatments: ["treatment_done", "treatment_cancelled"],
  debts: ["debt_created", "debt_payment", "debt_closed", "debt_overdue"],
  messages: ["notification_sent", "contacted"],
};

/** Which colour family a row belongs to: money, trouble, admin. */
export type EventTone = "success" | "info" | "warning" | "danger" | "accent" | "muted";

export function eventTone(kind: ClientEventKind): EventTone {
  switch (kind) {
    case "order_created":
    case "treatment_done":
    case "debt_payment":
    case "debt_closed":
      return "success";
    case "visit_arrived":
    case "visit_scheduled":
    case "app_linked":
    case "account_opened":
      return "info";
    case "debt_created":
    case "debt_overdue":
    case "visit_no_show":
      return "warning";
    case "order_cancelled":
    case "treatment_cancelled":
    case "visit_cancelled":
    case "blocked":
    case "anonymized":
      return "danger";
    case "gift_granted":
      return "accent";
    default:
      return "muted";
  }
}

/** Who performed the action, when the server names one. */
export interface EventActor {
  readonly id: number;
  readonly fullName: string;
}

/**
 * One entry on a client's history feed.
 *
 * `title` arrives as finished Uzbek prose — rendered verbatim. The app adds
 * only the icon, the colour and the time, which is what keeps the panel and the
 * backend from ever disagreeing about wording.
 */
export interface ClientEvent {
  /** Branch the record was made in; null on an older payload. */
  readonly filial: FilialRef | null;
  readonly id: number;
  readonly kind: ClientEventKind;
  /** Server label for the kind; empty rather than a guess. */
  readonly kindDisplay: string;
  readonly title: string;
  readonly amount: number | null;
  readonly doctor: DoctorRef | null;
  readonly actor: EventActor | null;
  /** `order` | `appointment` | `treatment` | `debt` | `note`. */
  readonly objectType: string;
  readonly objectId: string;
  /** Extra server-side context (`payment_type`, `has_debt`, …). */
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: TashkentDate;
}

/** True when tapping this row can open something. */
export function hasTarget(event: ClientEvent): boolean {
  return event.objectType !== "" && event.objectId !== "";
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseClientEvent(raw: unknown): ClientEvent {
  const e = isRecord(raw) ? raw : {};
  const actor = e.actor;
  return {
    filial: parseFilialRef(e.filial),
    id: typeof e.id === "number" ? e.id : Number(e.id ?? 0),
    kind: parseClientEventKind(e.kind),
    kindDisplay: str(e.kind_display),
    title: str(e.title),
    amount: typeof e.amount === "number" ? e.amount : null,
    doctor: maybeParseDoctorRef(e.doctor),
    actor: isRecord(actor)
      ? {
          id: typeof actor.id === "number" ? actor.id : Number(actor.id ?? 0),
          fullName: str(actor.full_name),
        }
      : null,
    objectType: str(e.object_type),
    objectId: str(e.object_id),
    data: isRecord(e.data) ? e.data : {},
    createdAt: tashkentFromApi(str(e.created_at)),
  };
}
