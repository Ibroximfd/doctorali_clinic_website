/**
 * What `POST orders/preview/` says a basket costs.
 *
 * **This is the authority on the money.** The form used to add the lines up
 * itself and hope the backend agreed; every rule added since (per-unit price
 * overrides, the loyalty gift's free unit, packaging prices, a hand-typed order
 * total) is another chance for the two arithmetics to drift — and a drift of
 * ONE so'm makes a split payment fail validation at save time with
 * `payments_mismatch`. So the desk shows what the server says, and `payments[]`
 * is built from the server's `paidNow`.
 *
 * The parse is deliberately forgiving about key names: a preview whose
 * `payable` arrives as `payable_amount` must still work rather than showing a
 * zero total at a busy desk. Anything genuinely missing is derived from the
 * fields that did arrive.
 */
export interface OrderPreview {
  /** What the lines come to before any order-level discount. */
  readonly subtotal: number;
  /** What the order is billed at (after a manual `total_override`). */
  readonly total: number;
  /** The free loyalty-gift unit, if one applies. */
  readonly giftDiscount: number;
  /**
   * What the client owes for this order — the same figure as `total`.
   *
   * Deliberately **not** the server's `payable` field: that one already has the
   * credited part taken out of it (it equals `paid_now`). Reading it as the
   * order total understates every sale that carries a debt.
   */
  readonly payable: number;
  /**
   * What reaches the till right now: `payable` − whatever went on credit.
   * **This is the number `payments[]` must add up to.**
   */
  readonly paidNow: number;
  /** The part of `payable` booked as debt. */
  readonly debtAmount: number;
  /** The doctor's commission on this basket, when the server computes it. */
  readonly commissionAmount: number | null;
  /** The natural sum before a manual total, when the server echoes it. */
  readonly originalTotal: number | null;
  /** Each cart line as the server prices it. */
  readonly lines: readonly OrderPreviewLine[];
}

/** One cart line as the server prices it. */
export interface OrderPreviewLine {
  readonly productId: string;
  readonly quantity: number;
  /** What one unit is billed at after the server spread the line's sum. */
  readonly unitPrice: number;
  readonly lineTotal: number;
  /** A free (`is_gift`) entry: quantity without money. */
  readonly isGift: boolean;
}

/** The paid line for a product — the gift entry carries no money. */
export function paidLineFor(
  preview: OrderPreview,
  productId: string,
): OrderPreviewLine | null {
  return preview.lines.find((l) => l.productId === productId && !l.isGift) ?? null;
}

/** True when the order is billed at a hand-typed total. */
export function isTotalOverridden(preview: OrderPreview): boolean {
  return preview.total !== preview.subtotal;
}

/** Negative for a discount, positive for a surcharge. */
export function overrideDelta(preview: OrderPreview): number {
  return preview.total - preview.subtotal;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function pickInt(
  source: Record<string, unknown>,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  }
  return null;
}

export function parseOrderPreview(raw: unknown): OrderPreview {
  const json = isRecord(raw) ? raw : {};
  // Some backends wrap the numbers in a `preview`/`totals` object; unwrap it
  // before looking for anything.
  const nested = json.preview ?? json.totals ?? json.order;
  const body: Record<string, unknown> = isRecord(nested) ? { ...json, ...nested } : json;

  // ONLY `gift_discount` is the loyalty gift. A generic `discount` also carries
  // the auto-boxing saving (nine pieces billed as a box), and labelling that
  // "🎁 Sovg'a" is what put a phantom "−1 200 000 sovg'a" on the desk's screen.
  const giftDiscount = pickInt(body, ["gift_discount"]) ?? 0;
  const rawPayable = pickInt(body, ["payable", "payable_amount", "amount_due"]);
  const rawTotal = pickInt(body, ["total_amount", "total", "amount"]);
  const rawSubtotal = pickInt(body, [
    "subtotal",
    "items_total",
    "products_total",
    "original_total",
  ]);

  const debtAmount =
    pickInt(body, ["debt_amount", "credited_amount"]) ??
    (isRecord(body.debt) ? (pickInt(body.debt, ["amount"]) ?? 0) : 0);

  /*
   * The contract, as the backend states it:
   *
   *   total / total_amount = 3 060 000   ← "Jami", debt NOT taken out
   *   debt_amount          =   500 000
   *   payable              = 2 560 000   ← debt ALREADY taken out
   *   paid_now             = 2 560 000   ← same figure, newer name
   *
   * So `payable` is the till amount, not the order total, and nothing here
   * subtracts the debt a second time. `total` is the only figure the "Jami"
   * line may come from.
   */
  const rawPaidNow = pickInt(body, ["paid_now", "paid_amount", "cash_now"]) ?? rawPayable;
  const total =
    rawTotal ?? rawSubtotal ?? (rawPaidNow !== null ? rawPaidNow + debtAmount : 0);
  const subtotal = rawSubtotal ?? total;
  const paidNow = rawPaidNow ?? total - debtAmount;

  const rawLines = Array.isArray(body.items) ? body.items : [];

  return {
    subtotal,
    total,
    giftDiscount,
    // What the client owes IS the total: the debt is a way of paying it, not a
    // reduction of it.
    payable: Math.max(0, total),
    paidNow: Math.max(0, paidNow),
    debtAmount: Math.max(0, debtAmount),
    commissionAmount: pickInt(body, ["commission_amount", "doctor_commission"]),
    originalTotal: pickInt(body, ["original_total"]),
    lines: rawLines.filter(isRecord).map((item) => {
      const quantity = pickInt(item, ["quantity"]) ?? 0;
      const unit = pickInt(item, ["unit_price"]) ?? 0;
      return {
        productId:
          item.product_id === null || item.product_id === undefined
            ? ""
            : String(item.product_id),
        quantity,
        unitPrice: unit,
        lineTotal: pickInt(item, ["line_total"]) ?? unit * quantity,
        isGift: item.is_gift === true,
      };
    }),
  };
}
