import {
  NO_PACKAGING,
  formatUnits,
  formatUnitsVerbose,
  hasPackaging,
  parsePackaging,
  type Packaging,
} from "@/shared/domain/packaging";

/**
 * A catalog product (`products/`).
 *
 * `priceUzs` is the final discounted price in whole so'm (API field `price`).
 * `id` is kept as a string (the API sends an integer) and converted back only
 * when building a request body.
 */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly priceUzs: number;
  readonly category: string;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
  /**
   * Showroom-only product (`reception_only`): sold at the desk but hidden from
   * the client app. Reception sees it and may sell or gift it normally — this
   * flag only drives a "🏪 Faqat showroom" hint so staff know it isn't in the
   * app. The app-side filtering is the backend's job, not ours.
   */
  readonly receptionOnly: boolean;
  readonly stockQuantity: number;
  readonly minQuantity: number;
  /**
   * Whether stock is tracked at all.
   *
   * **Defaults to false**, meaning "unlimited": a backend that doesn't send
   * stock fields yet must not make every product look out of stock and block
   * the whole order form.
   */
  readonly trackStock: boolean;
  /** Units per package (`package_size`) — e.g. Alatoo arrives as boxes of 9. */
  readonly packageSize: number | null;
  readonly packageLabel: string;
  /**
   * Sale price of one whole package. Null means a box has no price of its own —
   * nine pieces simply cost nine unit prices.
   */
  readonly packagePrice: number | null;
  /**
   * Whether loose pieces may be sold at all. Defaults to true so a backend that
   * doesn't send the field keeps selling by the piece exactly as before.
   */
  readonly unitSaleEnabled: boolean;
}

export function productPackaging(p: Product): Packaging {
  return p.packageSize === null
    ? NO_PACKAGING
    : { size: p.packageSize, label: p.packageLabel };
}

export function isOutOfStock(p: Product): boolean {
  return p.trackStock && p.stockQuantity <= 0;
}

export function isLowStock(p: Product): boolean {
  return p.trackStock && p.stockQuantity > 0 && p.stockQuantity <= p.minQuantity;
}

/** The most units that may be put in a cart, or null when unlimited. */
export function maxSellableQuantity(p: Product): number | null {
  return p.trackStock ? p.stockQuantity : null;
}

/** True when quantities are worth showing as packages too. */
export function productHasPackaging(p: Product): boolean {
  return hasPackaging(productPackaging(p));
}

/** True when full boxes are billed at their own price — the auto-boxing trigger. */
export function hasPackagePrice(p: Product): boolean {
  return productHasPackaging(p) && p.packagePrice !== null && p.packagePrice > 0;
}

/**
 * Sold strictly by the whole box — loose pieces are forbidden, and the backend
 * rejects any quantity that isn't a multiple of `packageSize`.
 */
export function isPackageOnly(p: Product): boolean {
  return productHasPackaging(p) && !p.unitSaleEnabled;
}

/**
 * Smallest sellable increment in base units: the whole box for package-only
 * products, a single piece otherwise. Every cart mutation moves in this step.
 */
export function saleStep(p: Product): number {
  return isPackageOnly(p) ? (p.packageSize as number) : 1;
}

export function formatProductUnits(p: Product, units: number): string {
  return formatUnits(productPackaging(p), units);
}

export function formatProductUnitsVerbose(p: Product, units: number): string {
  return formatUnitsVerbose(productPackaging(p), units);
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
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Tolerant parse: document lines embed a minimal `{id, name}` product, so
 * `name`/`price` must never hard-cast — a stock count that fails over a missing
 * price helps no one.
 */
export function parseProduct(raw: unknown): Product {
  const p = (raw ?? {}) as Record<string, unknown>;
  const packaging = parsePackaging(p);
  return {
    id: str(p.id),
    name: str(p.name),
    description: str(p.description),
    priceUzs: num(p.price),
    category: str(p.category),
    imageUrl: typeof p.image_url === "string" ? p.image_url : null,
    isActive: bool(p.is_active, true),
    receptionOnly: bool(p.reception_only, false),
    stockQuantity: num(p.stock_quantity),
    minQuantity: num(p.min_quantity),
    trackStock: bool(p.track_stock, false),
    packageSize: packaging.size,
    packageLabel: packaging.label,
    packagePrice: optNum(p.package_price),
    unitSaleEnabled: bool(p.unit_sale_enabled, true),
  };
}

/**
 * Copy with fresh stock facts — used when a stock row's own quantities must be
 * pushed into the nested product it carries (the API sends them at the row
 * level, not inside `product`).
 */
export function withStock(
  p: Product,
  patch: { stockQuantity?: number; minQuantity?: number; trackStock?: boolean },
): Product {
  return { ...p, ...patch };
}
