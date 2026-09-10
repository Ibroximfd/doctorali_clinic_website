/** A product that needs attention, as listed in the warehouse summary. */
export interface StockAlertItem {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  readonly minQuantity: number;
}

/** The KPI block above the warehouse page. */
export interface WarehouseSummary {
  readonly skuCount: number;
  /** How many of those SKUs actually have stock control on. */
  readonly trackedCount: number;
  readonly totalUnits: number;
  /** Everything on the shelves, valued at cost. */
  readonly stockValue: number;
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
  readonly lowStock: readonly StockAlertItem[];
  readonly outOfStock: readonly StockAlertItem[];
  readonly receivedMonth: number;
  readonly writtenOffMonth: number;
  readonly soldUnitsMonth: number;
}

export const EMPTY_WAREHOUSE_SUMMARY: WarehouseSummary = {
  skuCount: 0,
  trackedCount: 0,
  totalUnits: 0,
  stockValue: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  lowStock: [],
  outOfStock: [],
  receivedMonth: 0,
  writtenOffMonth: 0,
  soldUnitsMonth: 0,
};

/** Anything at all worth reception's attention right now. */
export function hasAlerts(summary: WarehouseSummary): boolean {
  return summary.lowStockCount > 0 || summary.outOfStockCount > 0;
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

function parseAlerts(raw: unknown): StockAlertItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((a) => ({
    productId: str(a.product_id),
    name: str(a.name),
    quantity: num(a.quantity),
    minQuantity: num(a.min_quantity),
  }));
}

export function parseWarehouseSummary(raw: unknown): WarehouseSummary {
  const s = isRecord(raw) ? raw : {};
  return {
    skuCount: num(s.sku_count),
    trackedCount: num(s.tracked_count),
    totalUnits: num(s.total_units),
    stockValue: num(s.stock_value),
    lowStockCount: num(s.low_stock_count),
    outOfStockCount: num(s.out_of_stock_count),
    lowStock: parseAlerts(s.low_stock),
    outOfStock: parseAlerts(s.out_of_stock),
    receivedMonth: num(s.received_month),
    writtenOffMonth: num(s.written_off_month),
    soldUnitsMonth: num(s.sold_units_month),
  };
}
