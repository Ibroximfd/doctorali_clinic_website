import { parseProduct, type Product } from "@/features/products/types/product";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { parseStockDocStatus, type StockDocStatus } from "./stock";

/**
 * One product on a stock count.
 *
 * `countedQty` is deliberately nullable, and that nullability is the whole
 * point: A LINE NOBODY COUNTED IS NOT A LINE COUNTED AS ZERO. Treating "not
 * reached yet" as "none left" would write off the entire uncounted remainder of
 * the shelf. Uncounted lines are skipped at confirmation.
 */
export interface StockCountLine {
  readonly product: Product;
  /** Snapshot of the balance when the count was opened. */
  readonly expectedQty: number;
  /** What was actually counted; null until someone enters it. */
  readonly countedQty: number | null;
  readonly costPrice: number;
  /** The server's own `diff_value` for this line, when it sent one. */
  readonly serverDiffValue: number | null;
}

export function lineDiff(line: StockCountLine): number | null {
  return line.countedQty === null ? null : line.countedQty - line.expectedQty;
}

/**
 * So'm value of the difference. The server's figure wins — it alone knows the
 * valuation; recomputed locally only as a fallback.
 */
export function lineDiffValue(line: StockCountLine): number | null {
  if (line.serverDiffValue !== null) return line.serverDiffValue;
  const diff = lineDiff(line);
  return diff === null ? null : diff * line.costPrice;
}

/** A stock count: count the shelves, then let the backend post the differences. */
export interface StockCount {
  readonly id: string;
  readonly number: string;
  readonly note: string;
  readonly status: StockDocStatus;
  readonly lines: readonly StockCountLine[];
  /**
   * Server-computed totals in UNITS (dona), not so'm — the documented example
   * (`total_shortage: 2` beside `diff_value: -140000`) fixes the semantics.
   */
  readonly totalShortage: number;
  readonly totalSurplus: number;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  readonly confirmedAt: TashkentDate | null;
}

export function countedCount(count: StockCount): number {
  return count.lines.filter((line) => line.countedQty !== null).length;
}

export function uncountedCount(count: StockCount): number {
  return count.lines.length - countedCount(count);
}

/** Lines whose count differs from the snapshot — what confirmation will fix. */
export function countDifferences(count: StockCount): readonly StockCountLine[] {
  return count.lines.filter((line) => {
    const diff = lineDiff(line);
    return diff !== null && diff !== 0;
  });
}

/** Local shortage/surplus totals in UNITS, for the preview before confirming. */
export function draftShortage(lines: readonly StockCountLine[]): number {
  return lines.reduce((sum, line) => {
    const diff = lineDiff(line) ?? 0;
    return sum + (diff < 0 ? -diff : 0);
  }, 0);
}

export function draftSurplus(lines: readonly StockCountLine[]): number {
  return lines.reduce((sum, line) => {
    const diff = lineDiff(line) ?? 0;
    return sum + (diff > 0 ? diff : 0);
  }, 0);
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
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseCountLine(raw: unknown): StockCountLine {
  const l = isRecord(raw) ? raw : {};
  return {
    product: parseProduct(l.product),
    expectedQty: num(l.expected_qty),
    countedQty: optNum(l.counted_qty),
    costPrice: num(l.cost_price),
    serverDiffValue: optNum(l.diff_value),
  };
}

export function parseStockCount(raw: unknown): StockCount {
  const c = isRecord(raw) ? raw : {};
  const createdBy = c.created_by;
  return {
    id: str(c.id),
    number: str(c.number),
    note: str(c.note),
    status: parseStockDocStatus(c.status),
    lines: Array.isArray(c.lines) ? c.lines.filter(isRecord).map(parseCountLine) : [],
    totalShortage: num(c.total_shortage),
    totalSurplus: num(c.total_surplus),
    createdByName: isRecord(createdBy) ? str(createdBy.full_name) : "",
    createdAt: tashkentFromApi(str(c.created_at)),
    confirmedAt:
      typeof c.confirmed_at === "string" && c.confirmed_at !== ""
        ? maybeTashkentFromApi(c.confirmed_at)
        : null,
  };
}
