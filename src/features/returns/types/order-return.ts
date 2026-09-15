import {
  parseOptionalPaymentType,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

/** One product line of a return document. */
export interface OrderReturnLine {
  readonly id: string;
  /** Catalog product id (`medicine` on the wire). */
  readonly productId: string;
  readonly productName: string;
  readonly quantity: number;
  /** Value of these units — NOT money out of the till. */
  readonly amount: number;
}

/**
 * A return (`POST orders/{id}/return/`, `GET returns/`).
 *
 * **Three sums, and they are different things.** Showing only one is how the
 * desk ends up asking "where did the money go?":
 *
 *   returnedValue = debtReduced + refundAmount
 *
 * `returnedValue` is what the goods were worth, `debtReduced` is the part
 * written off the client's debt (the till never saw it), and `refundAmount` is
 * the cash that actually left the drawer. The debt is settled FIRST, by design:
 * handing money to a client who still owes some is a pointless trip to the till.
 */
export interface OrderReturn {
  readonly id: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly items: readonly OrderReturnLine[];
  /** What the returned goods were worth. */
  readonly returnedValue: number;
  /** The part of it taken off the client's debt. */
  readonly debtReduced: number;
  /** What actually left the till. */
  readonly refundAmount: number;
  /**
   * Which till paid it out. **Null when nothing was paid out** — the server
   * reports `"none"` whenever `refundAmount` is 0, whatever was requested.
   */
  readonly refundPaymentType: PaymentType | null;
  /** True when nothing payable is left: the ORDER itself is now cancelled. */
  readonly isFull: boolean;
  readonly reason: string;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  readonly updatedAt: TashkentDate | null;
}

export function returnTotalUnits(doc: OrderReturn): number {
  return doc.items.reduce((sum, line) => sum + line.quantity, 0);
}

/**
 * "100 000 qarzdan · 0 naqd" — the sentence that answers "where did the money
 * go?" without the reader having to compare three figures themselves.
 */
export function refundSummary(doc: OrderReturn): string {
  const parts: string[] = [];
  if (doc.debtReduced > 0) parts.push(`${money.plain(doc.debtReduced)} qarzdan`);
  if (doc.refundAmount > 0) {
    const till = doc.refundPaymentType
      ? PAYMENT_TYPE_LABEL[doc.refundPaymentType]
      : "kassadan";
    parts.push(`${money.plain(doc.refundAmount)} ${till.toLowerCase()}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "Pul chiqmadi";
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

export function parseOrderReturnLine(raw: unknown): OrderReturnLine {
  const l = isRecord(raw) ? raw : {};
  const product = isRecord(l.product) ? l.product : {};
  return {
    id: str(l.id),
    // `medicine` is the backend's own name for the product key on this row.
    productId: str(l.medicine ?? l.product_id ?? product.id),
    productName: str(l.product_name ?? l.name ?? product.name),
    quantity: num(l.quantity),
    amount: num(l.amount ?? l.subtotal),
  };
}

export function parseOrderReturn(raw: unknown): OrderReturn {
  const r = isRecord(raw) ? raw : {};
  const order = r.order;
  return {
    id: str(r.id),
    // `order` is an id, but a list payload may nest the order itself.
    orderId: isRecord(order) ? str(order.id) : str(order),
    orderNumber: str(r.order_number ?? (isRecord(order) ? order.order_number : "")),
    items: Array.isArray(r.items) ? r.items.map(parseOrderReturnLine) : [],
    returnedValue: num(r.returned_value),
    debtReduced: num(r.debt_reduced),
    refundAmount: num(r.refund_amount),
    // "none" is not a till — it is the server saying no money moved.
    refundPaymentType: parseOptionalPaymentType(r.refund_payment_type),
    isFull: r.is_full === true,
    reason: str(r.reason),
    createdByName: isRecord(r.created_by)
      ? str(r.created_by.full_name)
      : str(r.created_by_name),
    createdAt: tashkentFromApi(str(r.created_at)),
    updatedAt: maybeTashkentFromApi(
      typeof r.updated_at === "string" ? r.updated_at : null,
    ),
  };
}
