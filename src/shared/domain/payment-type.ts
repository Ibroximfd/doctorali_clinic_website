import {
  CreditCard,
  MonitorSmartphone,
  Banknote,
  Wallet,
  CircleSlash,
  type LucideIcon,
} from "lucide-react";

/**
 * How the client physically paid at the desk (`payment_type`).
 *
 * Mandatory on every new reception order; orders created before this feature
 * existed are reported by the backend as `cash`.
 */
export const PAYMENT_TYPES = ["cash", "card", "terminal"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export function parsePaymentType(raw: unknown): PaymentType {
  return raw === "card" || raw === "terminal" ? raw : "cash";
}

/**
 * The strict parse: returns null for the two report-only sentinels the backend
 * uses, `"mixed"` and `"none"`, and for a record that predates the field.
 * Folding either of those into "cash" is what misstates a till.
 */
export function parseOptionalPaymentType(raw: unknown): PaymentType | null {
  if (raw === "cash" || raw === "card" || raw === "terminal") return raw;
  return null;
}

export const PAYMENT_TYPE_LABEL: Readonly<Record<PaymentType, string>> = {
  cash: "Naqd",
  card: "Karta",
  terminal: "Terminal",
};

export const PAYMENT_TYPE_ICON: Readonly<Record<PaymentType, LucideIcon>> = {
  cash: Banknote,
  card: CreditCard,
  terminal: MonitorSmartphone,
};

/**
 * Labels for an order paid with more than one type (`payment_type: "mixed"`).
 * Not a selectable value — "mixed" is only ever a display concept.
 */
export const MIXED_PAYMENT_LABEL = "Aralash";
export const MIXED_PAYMENT_ICON: LucideIcon = Wallet;

/**
 * Label for `payment_type: "none"` — nothing reached the till (the whole sum on
 * credit, or a 0-so'm gift order). Display-only, like "mixed".
 */
export const NO_PAYMENT_LABEL = "To'lanmagan";
export const NO_PAYMENT_ICON: LucideIcon = CircleSlash;

/** One slice of a split (mixed) payment. */
export interface OrderPayment {
  readonly type: PaymentType;
  /** Whole so'm paid with `type`; always > 0 when sent. */
  readonly amount: number;
}

export function parseOrderPayments(raw: unknown): OrderPayment[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderPayment[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const p = item as Record<string, unknown>;
    const amount = typeof p.amount === "number" ? p.amount : Number(p.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    out.push({ type: parsePaymentType(p.type), amount });
  }
  return out;
}

export function orderPaymentToJson(p: OrderPayment): Record<string, unknown> {
  return { type: p.type, amount: p.amount };
}
