import { parseGiftStatus, type GiftStatus } from "@/features/clients/types/client-ref";
import { maybeTashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/** A label on a client card — set by reception, or applied nightly by the backend. */
export interface ClientTag {
  /** Stable machine code, sent back on `POST clients/{id}/tags/`. */
  readonly code: string;
  readonly name: string;
  /** `#RRGGBB` from the server; empty when it didn't send one. */
  readonly colorHex: string;
  /**
   * True for a tag the backend maintains automatically. Those render with a
   * lock and cannot be edited: they describe a computed fact, and letting
   * reception clear one would only make the card lie until the next nightly run.
   */
  readonly isAuto: boolean;
}

/**
 * Parses a `tags` field that may be a list of objects (the CRM list) or a list
 * of bare codes (the typeahead payload).
 */
export function parseClientTags(raw: unknown): ClientTag[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item === "object" && item !== null) {
      const t = item as Record<string, unknown>;
      const code = t.code === null || t.code === undefined ? "" : String(t.code);
      return [
        {
          code,
          name: t.name === null || t.name === undefined ? code : String(t.name),
          colorHex: t.color === null || t.color === undefined ? "" : String(t.color),
          isAuto: t.is_auto === true,
        },
      ];
    }
    if (item === null || item === undefined) return [];
    const code = String(item);
    return [{ code, name: code, colorHex: "", isAuto: false }];
  });
}

/**
 * One typeahead row from `GET clients/search/?q=` — deliberately lighter than
 * the full card so the dropdown stays instant while reception types.
 *
 * It still carries the two things that decide what reception does next: how
 * many times this person has been in, and whether they owe money.
 */
export interface ClientSearchResult {
  readonly id: number;
  readonly fullName: string;
  /** API phone value `998XXXXXXXXX`. */
  readonly phone: string;
  readonly isAppUser: boolean;
  /** The backend's ready-made `display_name`; preferred over the raw name. */
  readonly serverDisplayName: string;
  readonly visitsCount: number;
  readonly ordersCount: number;
  readonly openDebt: number;
  readonly lastVisitAt: TashkentDate | null;
  readonly tags: readonly ClientTag[];
  readonly isBlocked: boolean;
  readonly avatarUrl: string | null;
  /** Loyalty progress, when the endpoint includes it. */
  readonly giftStatus: GiftStatus | null;
}

/**
 * Name safe to render: the server's `display_name` wins (ready text is never
 * re-derived locally), then the raw name, then the last four digits so a card
 * created from a phone alone is still identifiable.
 */
export function searchResultName(client: ClientSearchResult): string {
  const server = client.serverDisplayName.trim();
  if (server !== "") return server;
  const name = client.fullName.trim();
  if (name !== "") return name;
  const digits = client.phone.replace(/\D/g, "");
  return digits.length >= 4 ? `Mijoz ${digits.slice(-4)}` : "Mijoz";
}

export function hasOpenDebt(client: ClientSearchResult): boolean {
  return client.openDebt > 0;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseClientSearchResult(raw: unknown): ClientSearchResult {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    id: num(c.id),
    fullName: str(c.full_name),
    phone: str(c.phone),
    isAppUser: c.is_app_user === true,
    serverDisplayName: str(c.display_name),
    visitsCount: num(c.visits_count),
    ordersCount: num(c.orders_count),
    openDebt: num(c.open_debt),
    lastVisitAt: maybeTashkentFromApi(
      typeof c.last_visit_at === "string" ? c.last_visit_at : null,
    ),
    tags: parseClientTags(c.tags),
    isBlocked: c.is_blocked === true,
    avatarUrl:
      typeof c.avatar_url === "string"
        ? c.avatar_url
        : typeof c.photo === "string"
          ? c.photo
          : typeof c.image_url === "string"
            ? c.image_url
            : null,
    giftStatus: parseGiftStatus(c.gift_status),
  };
}
