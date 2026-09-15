import {
  parseProduct,
  productPackaging,
  type Product,
} from "@/features/products/types/product";
import { hasPackaging } from "@/shared/domain/packaging";
import { maybeTashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

import { parseStockMovement, type StockMovement } from "./movement";

/**
 * Lifecycle shared by every stock document (receipt, write-off, count).
 *
 * The rule the whole warehouse rests on: a DRAFT TOUCHES NOTHING. Stock only
 * ever moves when a document is confirmed, and a confirmed document is never
 * edited — it is reversed by another document. That is what makes the ledger
 * trustworthy.
 */
export const STOCK_DOC_STATUSES = ["draft", "confirmed", "cancelled"] as const;
export type StockDocStatus = (typeof STOCK_DOC_STATUSES)[number];

export function parseStockDocStatus(raw: unknown): StockDocStatus {
  return raw === "confirmed" || raw === "cancelled" ? raw : "draft";
}

export const STOCK_DOC_STATUS_LABEL: Readonly<Record<StockDocStatus, string>> = {
  draft: "Qoralama",
  confirmed: "Tasdiqlangan",
  cancelled: "Bekor qilingan",
};

/** Only a draft can be changed. */
export function isDocEditable(status: StockDocStatus): boolean {
  return status === "draft";
}

/**
 * One product's balance in the clinic's stock room.
 *
 * Everything here is read-only by design. There is no "edit the quantity" API
 * and no such button anywhere: a balance changes only through a document, which
 * is what keeps the ledger and the balance in agreement. The two fields
 * reception MAY change — `minQuantity` and `trackStock` — are settings, not
 * stock.
 */
export interface StockItem {
  readonly product: Product;
  readonly quantity: number;
  /** "Running low" threshold. */
  readonly minQuantity: number;
  /**
   * Weighted-average cost per unit, maintained by the backend from receipts.
   * Displayed, never edited — a hand-typed cost would corrupt every valuation
   * after it.
   */
  readonly costPrice: number;
  /** `quantity × costPrice`, computed server-side. */
  readonly stockValue: number;
  readonly isLow: boolean;
  readonly isOut: boolean;
  readonly trackStock: boolean;
  readonly lastReceiptAt: TashkentDate | null;
  readonly lastMovementAt: TashkentDate | null;
}

/**
 * The stock card of one product: its balance plus the context that answers
 * "should I reorder?" — recent sales and how many days of cover is left.
 */
export interface StockItemDetail {
  readonly item: StockItem;
  readonly sold30d: number;
  readonly avgDailySales: number;
  /**
   * How many days the balance covers at the recent rate; null when nothing has
   * sold — dividing by zero would claim "forever", a different and more
   * misleading answer than "unknown".
   */
  readonly daysOfStock: number | null;
  /**
   * The most recent ledger entries for this product, newest first — the
   * "Oxirgi harakatlar" block of the stock card, so "where did the balance go?"
   * is answered on the card itself rather than on the ledger tab.
   */
  readonly movements: readonly StockMovement[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function optDate(v: unknown): TashkentDate | null {
  return typeof v === "string" && v !== "" ? maybeTashkentFromApi(v) : null;
}

export function parseStockItem(raw: unknown): StockItem {
  const s = isRecord(raw) ? raw : {};
  const quantity = num(s.quantity);
  const minQuantity = num(s.min_quantity);
  const costPrice = num(s.cost_price);
  const trackStock = s.track_stock !== false;

  // The stock response's nested product carries no stock fields of its own —
  // copy the row-level quantities into it so anything downstream that receives
  // just the Product (the receipt dialog, the badges) sees the real balance
  // instead of zeros.
  const product: Product = {
    ...parseProduct(s.product),
    stockQuantity: quantity,
    minQuantity,
    trackStock,
  };

  return {
    product,
    quantity,
    minQuantity,
    costPrice,
    // Derived locally only when the server didn't compute them, so an older
    // payload still colours the row correctly.
    stockValue: typeof s.stock_value === "number" ? s.stock_value : quantity * costPrice,
    isLow:
      typeof s.is_low === "boolean"
        ? s.is_low
        : trackStock && quantity > 0 && quantity <= minQuantity,
    isOut: typeof s.is_out === "boolean" ? s.is_out : trackStock && quantity === 0,
    trackStock,
    lastReceiptAt: optDate(s.last_receipt_at),
    lastMovementAt: optDate(s.last_movement_at),
  };
}

export function parseStockItemDetail(raw: unknown): StockItemDetail {
  const s = isRecord(raw) ? raw : {};
  const item = parseStockItem(s);
  const packaging = productPackaging(item.product);
  return {
    item,
    sold30d: num(s.sold_30d),
    avgDailySales: num(s.avg_daily_sales),
    daysOfStock: typeof s.days_of_stock === "number" ? s.days_of_stock : null,
    movements: Array.isArray(s.movements)
      ? s.movements.filter(isRecord).map((row) => {
          const movement = parseStockMovement(row);
          // The card's own rows need not repeat the product each time; fill
          // what the ledger row left out from the card, so "−18" still reads
          // as "2 karobka" here.
          return {
            ...movement,
            productId: movement.productId || item.product.id,
            productName: movement.productName || item.product.name,
            packaging: hasPackaging(movement.packaging) ? movement.packaging : packaging,
          };
        })
      : [],
  };
}
