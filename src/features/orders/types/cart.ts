import {
  formatProductUnits,
  hasPackagePrice,
  isPackageOnly,
  maxSellableQuantity,
  saleStep,
  type Product,
} from "@/features/products/types/product";
import {
  orderPaymentToJson,
  type OrderPayment,
  type PaymentType,
} from "@/shared/domain/payment-type";

/**
 * One product line in the cart.
 *
 * `customPrice` lets reception LOWER the per-unit price the client pays (never
 * raise it — the backend rejects a price above the catalog price). When null
 * the catalog price applies.
 *
 * `giftQuantity` is how many of the line's units are handed over free
 * (`is_gift`) — from 0 up to the whole line. Gift units are billed at 0 and
 * carry no doctor commission, and a line split between paid and gift units is
 * sent to the backend as TWO items (see {@link orderItemsBody}).
 */
export interface CartItem {
  readonly product: Product;
  readonly quantity: number;
  readonly customPrice: number | null;
  /**
   * The sum reception actually typed for this line ("10 dona = 1 000 000").
   *
   * `customPrice` is only this figure divided by the paid units, and whole so'm
   * rarely divide evenly: 100 000 across 3 units bills 99 999. So the typed sum
   * travels to the server as `line_total` and **the server does the spreading**
   * — the division here is just what keeps an older backend, which only reads
   * `custom_price`, close to the right number.
   */
  readonly customLineTotal: number | null;
  readonly giftQuantity: number;
}

export function newCartItem(product: Product, quantity: number): CartItem {
  return {
    product,
    quantity,
    customPrice: null,
    customLineTotal: null,
    giftQuantity: 0,
  };
}

/** The per-unit price actually billed: the override when present. */
export function unitPrice(item: CartItem): number {
  return item.customPrice ?? item.product.priceUzs;
}

/** True when a manual price BELOW the catalog price is in effect. */
export function hasCustomPrice(item: CartItem): boolean {
  return item.customPrice !== null && item.customPrice < item.product.priceUzs;
}

/** Units the client actually pays for. */
export function paidQuantity(item: CartItem): number {
  return item.quantity - item.giftQuantity;
}

/**
 * Auto-boxing: when the product sells by the box too, every full box-worth of
 * PAID units is billed at the box price — automatically, so reception never
 * chooses (or forgets to choose) between the two prices.
 *
 * A manual price override wins outright: lowering the price is an explicit
 * decision about every unit on the line, so auto-boxing steps aside rather than
 * second-guessing it.
 */
function autoBoxes(item: CartItem): boolean {
  return hasPackagePrice(item.product) && !hasCustomPrice(item);
}

/** Full boxes being billed at the box price (0 unless auto-boxing). */
export function packagesBilled(item: CartItem): number {
  return autoBoxes(item)
    ? Math.trunc(paidQuantity(item) / (item.product.packageSize as number))
    : 0;
}

/** Paid units billed at the per-unit price. */
export function looseBilled(item: CartItem): number {
  return paidQuantity(item) - packagesBilled(item) * (item.product.packageSize ?? 0);
}

export function hasGift(item: CartItem): boolean {
  return item.giftQuantity > 0;
}

/** The entire line is a gift (nothing is billed). */
export function isFullGift(item: CartItem): boolean {
  return item.giftQuantity >= item.quantity;
}

/**
 * Amount actually billed. Gift units are free; with auto-boxing the full boxes
 * go at the box price and only the remainder at the unit price:
 * 20 dona Alatoo = 2 karobka narxi + 2 dona narxi.
 */
export function lineTotal(item: CartItem): number {
  if (autoBoxes(item)) {
    return (
      packagesBilled(item) * (item.product.packagePrice as number) +
      looseBilled(item) * unitPrice(item)
    );
  }
  return unitPrice(item) * paidQuantity(item);
}

/**
 * "2 karobka + 2 dona" — the billing breakdown, or null when the line is priced
 * plainly. Shown in the cart so the client sees what the total is made of.
 */
export function billingBreakdown(item: CartItem): string | null {
  if (!autoBoxes(item) || packagesBilled(item) === 0) return null;
  return formatProductUnits(item.product, paidQuantity(item));
}

// --- Quantity rules ----------------------------------------------------------

/**
 * The quantity actually allowed for a product: capped at the shelf balance,
 * then floored to a whole sale step (a no-op except for package-only products,
 * whose step is the box size).
 */
export function allowedQuantity(product: Product, requested: number): number {
  const limit = maxSellableQuantity(product);
  const capped = limit !== null && requested > limit ? limit : requested;
  const step = saleStep(product);
  return Math.trunc(capped / step) * step;
}

/** Gift units for a line, kept within `quantity` and on whole sale steps. */
export function allowedGift(product: Product, gift: number, quantity: number): number {
  const step = saleStep(product);
  const clamped = Math.min(Math.max(gift, 0), quantity);
  return Math.trunc(clamped / step) * step;
}

/**
 * "Omborda faqat 1 karobka + 6 dona" — what is left, in the product's own
 * packaging language, when a request had to be trimmed or refused.
 */
export function stockLimitNotice(product: Product): string {
  const limit = maxSellableQuantity(product);
  if (limit === null) return "Miqdor o'zgartirilmadi";
  return `Omborda faqat ${formatProductUnits(product, limit)}`;
}

/** True when a product can't be added at all right now. */
export function unsellableReason(product: Product): string | null {
  const limit = maxSellableQuantity(product);
  if (limit === null) return null;
  if (limit <= 0) return `Omborda tugagan: ${product.name}`;
  if (limit < saleStep(product)) {
    return `Omborda faqat ${limit} dona — butun ${product.packageLabel} uchun yetarli emas`;
  }
  return null;
}

export { isPackageOnly };

// --- Totals ------------------------------------------------------------------

/**
 * The money of one cart, computed in exactly one place.
 *
 * This is the LOCAL fallback only. `orders/preview/` is the authority (see
 * {@link import("./order-preview").OrderPreview}); these figures exist so an
 * unreachable preview endpoint degrades to a working form instead of a screen
 * full of zeros, and they are always labelled "taxminiy" when shown.
 */
export interface CartTotals {
  /** What the lines add up to on their own. */
  readonly subtotal: number;
  /** What the order is billed at: the subtotal, or a manual `total_override`. */
  readonly total: number;
  /** Value of the free loyalty-gift unit, if one applies. */
  readonly giftDiscount: number;
  /** What the client owes: the billed total less the free gift unit. */
  readonly payable: number;
}

export function computeCartTotals(input: {
  items: readonly CartItem[];
  totalOverride?: number | null;
  /** The loyalty gift; only produces a discount when it is also a paid line. */
  giftProduct?: Product | null;
}): CartTotals {
  const subtotal = input.items.reduce((sum, item) => sum + lineTotal(item), 0);
  const total =
    input.totalOverride === null || input.totalOverride === undefined
      ? subtotal
      : Math.max(0, input.totalOverride);

  let giftDiscount = 0;
  if (input.giftProduct) {
    for (const item of input.items) {
      if (item.product.id === input.giftProduct.id) {
        giftDiscount = unitPrice(item);
        break;
      }
    }
  }
  // A manual total is spread across the paid lines proportionally, so the free
  // unit is worth its share of the NEW price — otherwise a 20% discount would
  // still hand out a full-price gift and the preview would undershoot.
  if (giftDiscount > 0 && total !== subtotal && subtotal > 0) {
    giftDiscount = Math.round((giftDiscount * total) / subtotal);
  }
  if (giftDiscount > total) giftDiscount = total;

  return {
    subtotal,
    total,
    giftDiscount,
    payable: Math.max(0, total - giftDiscount),
  };
}

// --- Request bodies ----------------------------------------------------------

/**
 * Cart lines as the API wants them.
 *
 * A line split between paid and gift units becomes **two** entries: the paid
 * one, plus an `is_gift` one billed at 0 with no commission. A fully gifted line
 * contributes only the gift entry.
 */
export function orderItemsBody(items: readonly CartItem[]): Record<string, unknown>[] {
  const body: Record<string, unknown>[] = [];

  for (const item of items) {
    const productId = Number.parseInt(item.product.id, 10);
    const paid = paidQuantity(item);

    if (paid > 0) {
      body.push({
        product_id: productId,
        quantity: paid,
        // Only send a manual price when it actually lowers the line — the
        // backend rejects a price above the catalog price.
        ...(hasCustomPrice(item) ? { custom_price: item.customPrice } : {}),
        // The sum reception actually typed. The server bills THIS when it
        // supports the field, which is the only way "3 dona = 100 000" ends up
        // as exactly 100 000 rather than 99 999.
        ...(hasCustomPrice(item) && item.customLineTotal !== null
          ? { line_total: item.customLineTotal }
          : {}),
      });
    }

    if (item.giftQuantity > 0) {
      body.push({
        product_id: productId,
        quantity: item.giftQuantity,
        is_gift: true,
      });
    }
  }

  return body;
}

/**
 * The payment half of the body (§5.2).
 *
 * When nothing is payable — the whole sum went on credit, or it is a 0-so'm
 * full-gift order — the till took nothing, so **no `payments[]` are ever sent**:
 * a split can only divide money that actually moves, and the backend answers
 * `payments_mismatch` for anything else.
 *
 * The `payment_type` in that case is the desk's own call. Left alone it is
 * `"none"` (nothing reached the till), but reception may still mark how the
 * sale is booked — a free hand-out recorded as cash, a fully credited order the
 * client will settle by card. `paymentType` carries that choice, and null means
 * "not marked".
 *
 * With money to take, split parts take precedence; the backend ignores
 * `payment_type` when `payments` is present, so exactly one of the two is sent.
 */
export function orderPaymentBody(input: {
  paidNow: number;
  paymentType: PaymentType | null;
  payments: readonly OrderPayment[] | null;
}): Record<string, unknown> {
  if (input.paidNow === 0) {
    return { payment_type: input.paymentType ?? "none" };
  }
  if (input.payments && input.payments.length > 0) {
    return { payments: input.payments.map(orderPaymentToJson) };
  }
  return { payment_type: input.paymentType ?? "cash" };
}
