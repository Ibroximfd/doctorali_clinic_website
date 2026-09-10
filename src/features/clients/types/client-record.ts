import { parseGiftStatus, type GiftStatus } from "@/features/clients/types/client-ref";
import {
  parseClientTags,
  type ClientSearchResult,
  type ClientTag,
} from "@/features/clients/types/client-search";
import {
  dateFromYmd,
  daysBetween,
  maybeTashkentFromApi,
  nowTashkent,
  type TashkentDate,
} from "@/shared/lib/format/date";

/** How a client card first came into existence. */
export const CLIENT_SOURCES = [
  "app",
  "reception",
  "order",
  "delivery",
  "appointment",
  "treatment",
  "import",
  "unknown",
] as const;
export type ClientSource = (typeof CLIENT_SOURCES)[number];

/** `unknown` absorbs any value a newer backend introduces. */
export function parseClientSource(raw: unknown): ClientSource {
  return CLIENT_SOURCES.includes(raw as ClientSource) ? (raw as ClientSource) : "unknown";
}

export const CLIENT_SOURCE_LABEL: Readonly<Record<ClientSource, string>> = {
  app: "Ilova",
  reception: "Reception",
  order: "Buyurtma",
  delivery: "Dastavka",
  appointment: "Tashrif",
  treatment: "Muolaja",
  import: "Import",
  unknown: "Noma'lum",
};

/** `unknown` is most cards — reception rarely asks. */
export type ClientGender = "male" | "female" | "unknown";

export function parseClientGender(raw: unknown): ClientGender {
  return raw === "male" || raw === "female" ? raw : "unknown";
}

export const CLIENT_GENDER_LABEL: Readonly<Record<ClientGender, string>> = {
  male: "Erkak",
  female: "Ayol",
  unknown: "Ko'rsatilmagan",
};

/**
 * An additional phone on a card — a spouse's, a son's, a work line. The primary
 * number stays on `ClientRecord.phone`; these are extras reception can also
 * search by.
 */
export interface ClientPhone {
  /** API phone value `998XXXXXXXXX`. */
  readonly phone: string;
  /** Free-text note about whose number this is ("O'g'li", "Ish"). */
  readonly label: string;
}

/**
 * The clinic's single client card (backend `ClientProfile`).
 *
 * A card exists for EVERYONE who has ever been served, app user or not:
 * `isAppUser` is one attribute of the card, not the condition for having one.
 * The same shape backs the list row and the profile header, so the card can
 * render instantly from the row reception clicked and refresh behind it.
 */
export interface ClientRecord {
  /**
   * Backend id. **Null means "no card for this phone yet"** — the empty profile
   * that `clients/profile/?phone=` returns instead of a 404, so reception can
   * start a visit or an order straight from the empty result.
   */
  readonly id: number | null;
  readonly fullName: string;
  /** API phone value `998XXXXXXXXX`. */
  readonly phone: string;
  readonly extraPhones: readonly ClientPhone[];
  readonly avatarUrl: string | null;
  readonly gender: ClientGender;
  /** Server-rendered label; preferred over the local one. */
  readonly genderDisplay: string;
  readonly birthDate: TashkentDate | null;
  /** Derived from `birthDate` by the server, or typed by hand. */
  readonly age: number | null;
  /** True when `age` was typed rather than derived — rendered with a "~". */
  readonly ageIsEstimated: boolean;
  readonly address: string;
  readonly isAppUser: boolean;
  readonly isBlocked: boolean;
  readonly blockReason: string;
  readonly source: ClientSource;
  readonly sourceDisplay: string;
  readonly tags: readonly ClientTag[];
  /** Card-level note — allergies, warnings. Shown in the header. */
  readonly note: string;
  /** The backend's ready-made `display_name`. */
  readonly serverDisplayName: string;
  /** False means the client opted out — no reminders reach them. */
  readonly marketingConsent: boolean;
  /** `auto` unless the client picked a channel explicitly. */
  readonly preferredChannel: string;

  readonly visitsCount: number;
  readonly ordersCount: number;
  readonly ordersTotal: number;
  readonly paidTotal: number;
  readonly openDebt: number;
  readonly overdueDebt: number;
  readonly treatmentsCount: number;
  readonly treatmentsTotal: number;
  readonly giftStatus: GiftStatus | null;

  readonly firstSeenAt: TashkentDate | null;
  readonly lastVisitAt: TashkentDate | null;
  readonly lastOrderAt: TashkentDate | null;
  readonly lastContactAt: TashkentDate | null;
  readonly createdAt: TashkentDate | null;
}

/** True when this phone has no card behind it yet. */
export function isEmptyRecord(record: ClientRecord): boolean {
  return record.id === null;
}

/**
 * Name to render: the server's `display_name` wins (ready text is never
 * re-derived locally), then the raw name, then the last four digits so a card
 * created from a phone alone is still identifiable.
 */
export function recordName(record: ClientRecord): string {
  const server = record.serverDisplayName.trim();
  if (server !== "") return server;
  const trimmed = record.fullName.trim();
  if (trimmed !== "") return trimmed;
  const digits = record.phone.replace(/\D/g, "");
  return digits.length < 4 ? "Mijoz" : `Mijoz ${digits.slice(-4)}`;
}

export function genderLabel(record: ClientRecord): string {
  return record.genderDisplay.trim() || CLIENT_GENDER_LABEL[record.gender];
}

export function sourceLabel(record: ClientRecord): string {
  return record.sourceDisplay.trim() || CLIENT_SOURCE_LABEL[record.source];
}

/** Average amount per order; 0 when there are none yet. */
export function averageOrderAmount(record: ClientRecord): number {
  return record.ordersCount === 0
    ? 0
    : Math.round(record.ordersTotal / record.ordersCount);
}

/** Days since the last visit, or null when they have never been in. */
export function daysSinceLastVisit(record: ClientRecord): number | null {
  if (record.lastVisitAt === null) return null;
  return daysBetween(record.lastVisitAt, nowTashkent());
}

/** "Bugun" / "5 kun" / "—" — how long since they were last in. */
export function lastVisitLabel(record: ClientRecord): string {
  const days = daysSinceLastVisit(record);
  if (days === null) return "—";
  return days <= 0 ? "Bugun" : `${days} kun`;
}

/**
 * The lighter typeahead row this card would produce.
 *
 * Used when handing a client to the order form, which renders their debt and
 * visit count: every figure below comes from the card itself, so nothing is
 * invented to fill the shape.
 */
export function searchResultFromRecord(record: ClientRecord): ClientSearchResult {
  return {
    id: record.id ?? 0,
    fullName: record.fullName,
    phone: record.phone,
    isAppUser: record.isAppUser,
    serverDisplayName: record.serverDisplayName,
    visitsCount: record.visitsCount,
    ordersCount: record.ordersCount,
    openDebt: record.openDebt,
    lastVisitAt: record.lastVisitAt,
    tags: record.tags,
    isBlocked: record.isBlocked,
    avatarUrl: record.avatarUrl,
    giftStatus: record.giftStatus,
  };
}

/** An empty card for a phone the clinic has never seen. */
export function emptyRecord(phone: string): ClientRecord {
  return {
    id: null,
    fullName: "",
    phone,
    extraPhones: [],
    avatarUrl: null,
    gender: "unknown",
    genderDisplay: "",
    birthDate: null,
    age: null,
    ageIsEstimated: false,
    address: "",
    isAppUser: false,
    isBlocked: false,
    blockReason: "",
    source: "order",
    sourceDisplay: "",
    tags: [],
    note: "",
    serverDisplayName: "",
    marketingConsent: true,
    preferredChannel: "auto",
    visitsCount: 0,
    ordersCount: 0,
    ordersTotal: 0,
    paidTotal: 0,
    openDebt: 0,
    overdueDebt: 0,
    treatmentsCount: 0,
    treatmentsTotal: 0,
    giftStatus: null,
    firstSeenAt: null,
    lastVisitAt: null,
    lastOrderAt: null,
    lastContactAt: null,
    createdAt: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function optNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** Tolerates an id sent as a string, which some list endpoints still do. */
function optId(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

/**
 * Nullable timestamp parse: `tashkentFromApi` deliberately falls back to "now",
 * which would turn a missing `last_visit_at` into "visited today".
 */
function optDate(v: unknown): TashkentDate | null {
  return typeof v === "string" && v !== "" ? maybeTashkentFromApi(v) : null;
}

export function parseClientPhones(raw: unknown): ClientPhone[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (isRecord(item)) return [{ phone: str(item.phone), label: str(item.label) }];
    if (item === null || item === undefined) return [];
    return [{ phone: String(item), label: "" }];
  });
}

export function parseClientRecord(raw: unknown): ClientRecord {
  const c = isRecord(raw) ? raw : {};
  return {
    id: optId(c.id),
    fullName: str(c.full_name),
    phone: str(c.phone),
    extraPhones: parseClientPhones(c.extra_phones),
    avatarUrl:
      typeof c.avatar_url === "string"
        ? c.avatar_url
        : typeof c.photo === "string"
          ? c.photo
          : typeof c.image_url === "string"
            ? c.image_url
            : null,
    gender: parseClientGender(c.gender),
    genderDisplay: str(c.gender_display),
    birthDate:
      typeof c.birth_date === "string" && c.birth_date !== ""
        ? dateFromYmd(c.birth_date)
        : null,
    age: optNum(c.age),
    ageIsEstimated: c.age_is_estimated === true,
    address: str(c.address),
    isAppUser: c.is_app_user === true,
    isBlocked: c.is_blocked === true,
    blockReason: str(c.block_reason),
    source: parseClientSource(c.source),
    sourceDisplay: str(c.source_display),
    tags: parseClientTags(c.tags),
    note: str(c.note),
    serverDisplayName: str(c.display_name),
    marketingConsent: c.marketing_consent !== false,
    preferredChannel: str(c.preferred_channel, "auto"),
    visitsCount: num(c.visits_count),
    ordersCount: num(c.orders_count),
    ordersTotal: num(c.orders_total),
    paidTotal: num(c.paid_total),
    openDebt: num(c.open_debt),
    overdueDebt: num(c.overdue_debt),
    treatmentsCount: num(c.treatments_count),
    treatmentsTotal: num(c.treatments_total),
    giftStatus: parseGiftStatus(c.gift_status),
    firstSeenAt: optDate(c.first_seen_at),
    lastVisitAt: optDate(c.last_visit_at),
    lastOrderAt: optDate(c.last_order_at),
    lastContactAt: optDate(c.last_contact_at),
    createdAt: optDate(c.created_at),
  };
}
