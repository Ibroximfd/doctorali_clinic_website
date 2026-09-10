/**
 * The client card as it is embedded inside another object — an order, a debt, a
 * treatment, an appointment — plus the loyalty progress that rides along.
 *
 * Since the CRM rework EVERY one of those payloads carries a `client` block:
 * the backend resolves a card for every sale, even a walk-in who has never
 * installed the app. So this ref is never null in a fresh response; the
 * nullable helpers exist only so an older payload can't break a screen.
 */

/** Loyalty / gift progress. A gift is granted every 10th delivered order. */
export interface GiftStatus {
  readonly deliveredOrders: number;
  readonly ordersUntilGift: number;
  readonly giftAvailable: boolean;
  /** Server-written sentence, shown verbatim. */
  readonly message: string;
}

/** Progress toward the next gift, e.g. `9/10`. */
export function giftProgressLabel(g: GiftStatus): string {
  return `${g.deliveredOrders}/${g.deliveredOrders + g.ordersUntilGift}`;
}

export interface ClientRef {
  /** Backend `ClientProfile` id — the key to open the 360° card. */
  readonly id: number;
  readonly fullName: string;
  /** API phone value `998XXXXXXXXX`. */
  readonly phone: string;
  readonly avatarUrl: string | null;
  /**
   * True when the phone is linked to a mobile-app account, which decides
   * whether an automatic reminder can reach this client at all.
   */
  readonly isAppUser: boolean;
  readonly giftStatus: GiftStatus | null;
}

/**
 * Name safe to render: falls back to the last four digits, so a card created
 * from a phone alone is still recognisable in a list.
 */
export function clientDisplayName(
  client: Pick<ClientRef, "fullName" | "phone"> & {
    serverDisplayName?: string;
  },
): string {
  const server = client.serverDisplayName?.trim();
  if (server) return server;
  const trimmed = client.fullName.trim();
  if (trimmed !== "") return trimmed;
  const digits = client.phone.replace(/\D/g, "");
  if (digits.length < 4) return "Mijoz";
  return `Mijoz ${digits.slice(-4)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function parseGiftStatus(raw: unknown): GiftStatus | null {
  if (!isRecord(raw)) return null;
  return {
    deliveredOrders: typeof raw.delivered_orders === "number" ? raw.delivered_orders : 0,
    ordersUntilGift:
      typeof raw.orders_until_gift === "number" ? raw.orders_until_gift : 0,
    giftAvailable: raw.gift_available === true,
    message: raw.message === null || raw.message === undefined ? "" : String(raw.message),
  };
}

export function parseClientRef(raw: unknown): ClientRef {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    id: typeof c.id === "number" ? c.id : Number(c.id ?? 0),
    fullName:
      c.full_name === null || c.full_name === undefined ? "" : String(c.full_name),
    phone: c.phone === null || c.phone === undefined ? "" : String(c.phone),
    avatarUrl:
      typeof c.avatar_url === "string"
        ? c.avatar_url
        : typeof c.photo === "string"
          ? c.photo
          : typeof c.image_url === "string"
            ? c.image_url
            : null,
    isAppUser: c.is_app_user === true,
    giftStatus: parseGiftStatus(c.gift_status),
  };
}

export function maybeParseClientRef(raw: unknown): ClientRef | null {
  return isRecord(raw) ? parseClientRef(raw) : null;
}
