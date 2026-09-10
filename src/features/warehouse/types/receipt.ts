import { parseProduct, type Product } from "@/features/products/types/product";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { parseStockDocStatus, type StockDocStatus } from "./stock";

/**
 * One product line on a goods-in document.
 *
 * A delivery of a packaged product (Alatoo: 1 karobka = 9 dona) is entered as
 * PACKAGES + LOOSE UNITS, exactly the way the goods physically arrive — which
 * is what stops "5 karobka" from ever being typed as "5 dona". The ledger
 * itself only ever sees the base-unit total.
 */
export interface StockReceiptLine {
  readonly product: Product;
  /** Loose base units (dona), on top of any full packages. */
  readonly quantity: number;
  /** Full packages (karobka). Always 0 for an unpackaged product. */
  readonly packages: number;
  /**
   * Cost per unit for this delivery. ZERO MEANS "keep the existing cost" — the
   * backend leaves the weighted average alone rather than averaging a zero into
   * it, which would silently destroy the valuation.
   */
  readonly unitCost: number;
  /**
   * Cost per package, the way suppliers actually quote a boxed product. The
   * backend values the line from the package total, so 100 000 for a box of 9
   * never degrades into 9 × 11 111 = 99 999.
   */
  readonly packageCost: number;
}

/** What actually lands on the shelf, in base units. */
export function lineTotalUnits(line: StockReceiptLine): number {
  return line.packages * (line.product.packageSize ?? 0) + line.quantity;
}

/**
 * Line value for the on-screen total, mirroring the backend's maths: full
 * packages at the package price, loose units at the unit price (derived from
 * the package price when only that was given).
 */
export function lineCost(line: StockReceiptLine): number {
  const size = line.product.packageSize ?? 0;
  const derivedUnitCost =
    line.unitCost > 0
      ? line.unitCost
      : line.packageCost > 0 && size > 0
        ? Math.round(line.packageCost / size)
        : 0;
  return line.packages * line.packageCost + line.quantity * derivedUnitCost;
}

/**
 * The request map for one line — ONE MAP PER PRODUCT.
 *
 * A mixed delivery ("3 karobka + 2 dona") must not go as two entries with the
 * same `product_id`: the backend rejects that pair as a duplicate line, so both
 * halves travel together. `quantity` is always present (0 when the delivery is
 * whole boxes only), so a line can never arrive without a countable amount.
 */
export function receiptLineBody(line: StockReceiptLine): Record<string, unknown> {
  return {
    product_id: Number.parseInt(line.product.id, 10),
    ...(line.packages > 0 ? { packages: line.packages } : {}),
    ...(line.packages > 0 && line.packageCost > 0
      ? { package_cost: line.packageCost }
      : {}),
    quantity: line.quantity,
    ...(line.quantity > 0 && line.unitCost > 0 ? { unit_cost: line.unitCost } : {}),
  };
}

/**
 * A goods-in document.
 *
 * Confirming it is what actually raises the balances and recomputes the
 * weighted-average cost; while it is a draft it exists only on paper.
 */
export interface StockReceipt {
  readonly id: string;
  /** Server-assigned document number (`KIR-20260807-001`). */
  readonly number: string;
  readonly supplier: string;
  readonly note: string;
  readonly status: StockDocStatus;
  /** Total cost, computed on confirmation. */
  readonly totalCost: number;
  readonly lines: readonly StockReceiptLine[];
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  readonly confirmedAt: TashkentDate | null;
  readonly cancelledAt: TashkentDate | null;
  readonly cancelReason: string;
}

export function receiptTotalUnits(receipt: StockReceipt): number {
  return receipt.lines.reduce((sum, line) => sum + lineTotalUnits(line), 0);
}

/** Sum of the typed lines — used while the server has computed no total yet. */
export function receiptDraftCost(lines: readonly StockReceiptLine[]): number {
  return lines.reduce((sum, line) => sum + lineCost(line), 0);
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
function optDate(v: unknown): TashkentDate | null {
  return typeof v === "string" && v !== "" ? maybeTashkentFromApi(v) : null;
}

export function parseReceiptLine(raw: unknown): StockReceiptLine {
  const l = isRecord(raw) ? raw : {};
  return {
    product: parseProduct(l.product),
    // The response `quantity` is ALWAYS the base-unit total and `packages` is
    // request-only — parsing an echoed `packages` here would double-count the
    // units on a reopened draft.
    quantity: num(l.quantity),
    packages: 0,
    unitCost: num(l.unit_cost),
    packageCost: num(l.package_cost),
  };
}

export function parseStockReceipt(raw: unknown): StockReceipt {
  const r = isRecord(raw) ? raw : {};
  const createdBy = r.created_by;
  return {
    id: str(r.id),
    number: str(r.number),
    supplier: str(r.supplier),
    note: str(r.note),
    status: parseStockDocStatus(r.status),
    totalCost: num(r.total_cost),
    lines: Array.isArray(r.lines) ? r.lines.filter(isRecord).map(parseReceiptLine) : [],
    createdByName: isRecord(createdBy) ? str(createdBy.full_name) : "",
    createdAt: tashkentFromApi(str(r.created_at)),
    confirmedAt: optDate(r.confirmed_at),
    cancelledAt: optDate(r.cancelled_at),
    cancelReason: str(r.cancel_reason),
  };
}
