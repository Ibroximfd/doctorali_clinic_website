import { IDEMPOTENCY_HEADER, endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";
import { uuidV4 } from "@/shared/lib/uuid";

import { parseStockCount, type StockCount } from "../types/count";
import {
  parseStockMovement,
  type StockMovement,
  type StockMovementType,
} from "../types/movement";
import {
  parseStockReceipt,
  receiptLineBody,
  type StockReceipt,
  type StockReceiptLine,
} from "../types/receipt";
import {
  parseStockItem,
  parseStockItemDetail,
  type StockItem,
  type StockItemDetail,
} from "../types/stock";
import { parseWarehouseSummary, type WarehouseSummary } from "../types/summary";
import {
  parseStockWriteOff,
  type StockWriteOff,
  type StockWriteOffLine,
  type WriteOffReason,
} from "../types/write-off";

// --- Filters -----------------------------------------------------------------

export const STOCK_ORDERINGS = ["name", "quantity", "-quantity", "-stock_value"] as const;
export type StockOrdering = (typeof STOCK_ORDERINGS)[number];

export const STOCK_ORDERING_LABEL: Readonly<Record<StockOrdering, string>> = {
  name: "Nomi (A–Z)",
  quantity: "Qoldiq (kam)",
  "-quantity": "Qoldiq (ko'p)",
  "-stock_value": "Qiymati",
};

export interface StockFilter {
  readonly search?: string;
  readonly category?: string | null;
  /** Only products at or below their threshold. */
  readonly lowStockOnly?: boolean;
  /** Only products with nothing left. */
  readonly outOfStockOnly?: boolean;
  readonly ordering?: StockOrdering;
}

export function stockFilterQuery(filter: StockFilter): Query {
  return {
    ordering: filter.ordering ?? "name",
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(filter.lowStockOnly ? { low_stock: "true" } : {}),
    ...(filter.outOfStockOnly ? { out_of_stock: "true" } : {}),
  };
}

export function stockFilterKey(filter: StockFilter): readonly unknown[] {
  return [
    filter.search?.trim() ?? "",
    filter.category ?? null,
    filter.lowStockOnly === true,
    filter.outOfStockOnly === true,
    filter.ordering ?? "name",
  ];
}

export interface MovementFilter {
  readonly productId?: string | null;
  readonly type?: StockMovementType | null;
  readonly dateFrom?: TashkentDate | null;
  readonly dateTo?: TashkentDate | null;
  readonly orderId?: string | null;
}

export function movementFilterQuery(filter: MovementFilter): Query {
  return {
    ...(filter.productId ? { product_id: filter.productId } : {}),
    ...(filter.type && filter.type !== "unknown" ? { movement_type: filter.type } : {}),
    ...(filter.dateFrom ? { date_from: ymd(filter.dateFrom) } : {}),
    ...(filter.dateTo ? { date_to: ymd(filter.dateTo) } : {}),
    ...(filter.orderId ? { order_id: filter.orderId } : {}),
  };
}

export function movementFilterKey(filter: MovementFilter): readonly unknown[] {
  return [
    filter.productId ?? null,
    filter.type ?? null,
    filter.dateFrom?.getTime() ?? null,
    filter.dateTo?.getTime() ?? null,
    filter.orderId ?? null,
  ];
}

// --- Reads -------------------------------------------------------------------

export function fetchStock(input: {
  filter: StockFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<StockItem>> {
  return http
    .get<unknown>(endpoints.warehouseStock, {
      query: { page: input.page ?? 1, ...stockFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseStockItem));
}

export function fetchStockItem(
  productId: string,
  signal?: AbortSignal,
): Promise<StockItemDetail> {
  return http
    .get<unknown>(endpoints.warehouseStockItem(productId), { signal })
    .then(parseStockItemDetail);
}

export function fetchMovements(input: {
  filter: MovementFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<StockMovement>> {
  return http
    .get<unknown>(endpoints.warehouseMovements, {
      query: { page: input.page ?? 1, ...movementFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseStockMovement));
}

export function fetchWarehouseSummary(signal?: AbortSignal): Promise<WarehouseSummary> {
  return http
    .get<unknown>(endpoints.warehouseSummary, { signal })
    .then(parseWarehouseSummary);
}

export function fetchReceipts(page = 1, signal?: AbortSignal) {
  return http
    .get<unknown>(endpoints.warehouseReceipts, { query: { page }, signal })
    .then((raw) => parsePaginated(raw as never, parseStockReceipt));
}

export function fetchWriteOffs(page = 1, signal?: AbortSignal) {
  return http
    .get<unknown>(endpoints.warehouseWriteOffs, { query: { page }, signal })
    .then((raw) => parsePaginated(raw as never, parseStockWriteOff));
}

export function fetchCounts(page = 1, signal?: AbortSignal) {
  return http
    .get<unknown>(endpoints.warehouseCounts, { query: { page }, signal })
    .then((raw) => parsePaginated(raw as never, parseStockCount));
}

// --- Stock settings ----------------------------------------------------------

/** Settings only: the low-stock threshold and whether the product is tracked. */
export function updateStockSettings(
  productId: string,
  changes: { minQuantity?: number; trackStock?: boolean },
): Promise<StockItem> {
  return http
    .patch<unknown>(endpoints.warehouseStockItem(productId), {
      json: {
        ...(changes.minQuantity !== undefined
          ? { min_quantity: changes.minQuantity }
          : {}),
        ...(changes.trackStock !== undefined ? { track_stock: changes.trackStock } : {}),
      },
    })
    .then(parseStockItem);
}

/**
 * The changed half of the packaging form.
 *
 * Every field is tri-state — absent, a value, or an explicit `null` — because
 * the endpoint reads the three cases differently and one of them is not
 * cosmetic. Sending `unit_price` AT ALL switches the product into "the catalog
 * price is the box price" mode, so re-sending an unchanged piece price would
 * turn a plain product into a boxed-priced one behind reception's back.
 * `package_size: null` is how packaging is switched off; omitting the key
 * leaves it alone.
 */
export interface PackagingUpdate {
  readonly packageSize?: number;
  readonly clearPackageSize?: boolean;
  readonly packagePrice?: number;
  readonly clearPackagePrice?: boolean;
  readonly unitPrice?: number;
  readonly clearUnitPrice?: boolean;
  readonly unitSaleEnabled?: boolean;
  readonly packageLabel?: string;
}

export function packagingUpdateBody(changes: PackagingUpdate): Record<string, unknown> {
  return {
    ...(changes.clearPackageSize
      ? { package_size: null }
      : changes.packageSize !== undefined
        ? { package_size: changes.packageSize }
        : {}),
    ...(changes.clearPackagePrice
      ? { package_price: null }
      : changes.packagePrice !== undefined
        ? { package_price: changes.packagePrice }
        : {}),
    ...(changes.clearUnitPrice
      ? { unit_price: null }
      : changes.unitPrice !== undefined
        ? { unit_price: changes.unitPrice }
        : {}),
    ...(changes.unitSaleEnabled !== undefined
      ? { unit_sale_enabled: changes.unitSaleEnabled }
      : {}),
    ...(changes.packageLabel !== undefined
      ? { package_label: changes.packageLabel }
      : {}),
  };
}

/** True when reception changed nothing — the save is then a no-op. */
export function isPackagingUpdateEmpty(changes: PackagingUpdate): boolean {
  return Object.keys(packagingUpdateBody(changes)).length === 0;
}

export function updatePackaging(
  productId: string,
  changes: PackagingUpdate,
): Promise<StockItem> {
  return http
    .patch<unknown>(endpoints.warehouseStockItem(productId), {
      json: packagingUpdateBody(changes),
    })
    .then(parseStockItem);
}

// --- Goods in ----------------------------------------------------------------

export interface ReceiptDraft {
  readonly lines: readonly StockReceiptLine[];
  readonly supplier: string;
  readonly note: string;
  /** One key per submission — a retried confirmation must not double a delivery. */
  readonly idempotencyKey?: string;
}

function receiptBody(draft: ReceiptDraft): Record<string, unknown> {
  return {
    ...(draft.supplier.trim() !== "" ? { supplier: draft.supplier.trim() } : {}),
    ...(draft.note.trim() !== "" ? { note: draft.note.trim() } : {}),
    lines: draft.lines.map(receiptLineBody),
  };
}

export function createReceipt(draft: ReceiptDraft): Promise<StockReceipt> {
  return http
    .post<unknown>(endpoints.warehouseReceipts, {
      json: receiptBody(draft),
      headers: { [IDEMPOTENCY_HEADER]: draft.idempotencyKey ?? uuidV4() },
    })
    .then(parseStockReceipt);
}

/** Replaces a draft's lines wholesale. Confirmed documents are immutable. */
export function updateReceipt(id: string, draft: ReceiptDraft): Promise<StockReceipt> {
  return http
    .patch<unknown>(endpoints.warehouseReceipt(id), {
      json: receiptBody(draft),
    })
    .then(parseStockReceipt);
}

/** Posts the delivery: balances rise and the weighted-average cost updates. */
export function confirmReceipt(id: string): Promise<StockReceipt> {
  return http
    .post<unknown>(endpoints.warehouseReceiptConfirm(id))
    .then(parseStockReceipt);
}

/**
 * Reverses a confirmed delivery. Fails with `stock_would_go_negative` when the
 * goods have already been sold.
 */
export function cancelReceipt(id: string, reason: string): Promise<StockReceipt> {
  return http
    .post<unknown>(endpoints.warehouseReceiptCancel(id), {
      json: { reason: reason.trim() },
    })
    .then(parseStockReceipt);
}

// --- Write-offs --------------------------------------------------------------

export interface WriteOffDraft {
  readonly reason: WriteOffReason;
  readonly note: string;
  readonly lines: readonly StockWriteOffLine[];
  readonly idempotencyKey?: string;
}

export function createWriteOff(draft: WriteOffDraft): Promise<StockWriteOff> {
  return http
    .post<unknown>(endpoints.warehouseWriteOffs, {
      json: {
        reason: draft.reason,
        ...(draft.note.trim() !== "" ? { note: draft.note.trim() } : {}),
        lines: draft.lines.map((line) => ({
          product_id: Number.parseInt(line.product.id, 10),
          quantity: line.quantity,
        })),
      },
      headers: { [IDEMPOTENCY_HEADER]: draft.idempotencyKey ?? uuidV4() },
    })
    .then(parseStockWriteOff);
}

export function confirmWriteOff(id: string): Promise<StockWriteOff> {
  return http
    .post<unknown>(endpoints.warehouseWriteOffConfirm(id))
    .then(parseStockWriteOff);
}

/** The reason is mandatory; cancelling a confirmed document returns the units. */
export function cancelWriteOff(id: string, reason: string): Promise<StockWriteOff> {
  return http
    .post<unknown>(endpoints.warehouseWriteOffCancel(id), {
      json: { reason: reason.trim() },
    })
    .then(parseStockWriteOff);
}

// --- Stock counts ------------------------------------------------------------

/** Opens a count; omitting `productIds` snapshots every tracked product. */
export function createCount(input: {
  productIds?: readonly string[];
  note?: string;
}): Promise<StockCount> {
  return http
    .post<unknown>(endpoints.warehouseCounts, {
      json: {
        ...(input.productIds
          ? {
              product_ids: input.productIds.map((id) => Number.parseInt(id, 10)),
            }
          : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
    })
    .then(parseStockCount);
}

/**
 * Saves counted quantities incrementally — as often as the counter types, so a
 * closed browser never loses an afternoon of counting.
 */
export function updateCountLines(
  id: string,
  countedByProductId: Readonly<Record<string, number>>,
): Promise<StockCount> {
  return http
    .patch<unknown>(endpoints.warehouseCount(id), {
      json: {
        lines: Object.entries(countedByProductId).map(([productId, counted]) => ({
          product_id: Number.parseInt(productId, 10),
          counted_qty: counted,
        })),
      },
    })
    .then(parseStockCount);
}

/** Posts the differences as ledger movements. Uncounted lines are skipped. */
export function confirmCount(id: string): Promise<StockCount> {
  return http.post<unknown>(endpoints.warehouseCountConfirm(id)).then(parseStockCount);
}

// --- Export ------------------------------------------------------------------

/**
 * `GET warehouse/export/`.
 *
 * A date range makes it a PERIOD REPORT: what was sold, gifted, taken in and
 * written off on each day, next to the balance the period ended on. Without one
 * the server exports balances only.
 */
export function exportWarehouse(input: {
  filter: StockFilter;
  dateFrom?: TashkentDate | null;
  dateTo?: TashkentDate | null;
}) {
  return http.blob(endpoints.warehouseExport, {
    query: {
      ...stockFilterQuery(input.filter),
      ...(input.dateFrom ? { date_from: ymd(input.dateFrom) } : {}),
      ...(input.dateTo ? { date_to: ymd(input.dateTo) } : {}),
    },
    fallbackFileName: "sklad.xlsx",
  });
}
