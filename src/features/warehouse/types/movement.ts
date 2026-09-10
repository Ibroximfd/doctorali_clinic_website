import {
  parsePackaging,
  formatUnits,
  hasPackaging,
  type Packaging,
} from "@/shared/domain/packaging";
import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/**
 * Why stock moved. `unknown` absorbs any type a newer backend introduces, so
 * the ledger renders rather than breaking on an unfamiliar row.
 */
export const MOVEMENT_TYPES = [
  "receipt",
  "sale",
  "sale_return",
  "gift",
  "gift_return",
  "write_off",
  "count_adjust",
  "receipt_cancel",
  "unknown",
] as const;
export type StockMovementType = (typeof MOVEMENT_TYPES)[number];

export function parseMovementType(raw: unknown): StockMovementType {
  return MOVEMENT_TYPES.includes(raw as StockMovementType)
    ? (raw as StockMovementType)
    : "unknown";
}

export const MOVEMENT_TYPE_LABEL: Readonly<Record<StockMovementType, string>> = {
  receipt: "Kirim",
  sale: "Sotuv",
  sale_return: "Sotuv qaytdi",
  gift: "Sovg'a",
  gift_return: "Sovg'a qaytdi",
  write_off: "Chiqim",
  count_adjust: "Inventarizatsiya",
  receipt_cancel: "Kirim bekor qilindi",
  unknown: "Boshqa",
};

/** The types the ledger filter offers — `unknown` is a read state, not a filter. */
export const FILTERABLE_MOVEMENT_TYPES = MOVEMENT_TYPES.filter(
  (type) => type !== "unknown",
);

/** What caused a movement — the document or order behind it. */
export interface MovementSource {
  /** `order` | `receipt` | `write_off` | `count`. */
  readonly type: string;
  readonly id: string;
  /** Human-facing document number (`ORD-…`, `KIR-…`). */
  readonly number: string;
}

export function movementSourceLabel(source: MovementSource): string {
  return source.number !== "" ? source.number : source.id;
}

/**
 * One line of the append-only stock ledger.
 *
 * `quantity` is SIGNED (+in, −out) and `balanceAfter` is the balance the
 * movement left behind. Together they make the whole history auditable: any
 * balance can be re-derived by replaying the ledger, which is exactly what the
 * backend's nightly reconciliation does.
 */
export interface StockMovement {
  readonly id: number;
  readonly productId: string;
  readonly productName: string;
  readonly type: StockMovementType;
  readonly typeDisplay: string;
  /** Signed: positive adds, negative removes. Never zero. */
  readonly quantity: number;
  readonly balanceAfter: number;
  /** Unit cost at the time of the movement (a snapshot). */
  readonly costPrice: number;
  readonly source: MovementSource | null;
  readonly note: string;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  /** How the product is boxed, when the ledger payload says so. */
  readonly packaging: Packaging;
}

export function movementTypeLabel(movement: StockMovement): string {
  return movement.typeDisplay.trim() || MOVEMENT_TYPE_LABEL[movement.type];
}

/** `+50` / `−2` — the sign is part of the value, not decoration. */
export function signedQuantityLabel(movement: StockMovement): string {
  return movement.quantity > 0
    ? `+${movement.quantity}`
    : `−${Math.abs(movement.quantity)}`;
}

/** `−18` → `2 karobka`; empty for an unboxed product. */
export function packagedQuantityLabel(movement: StockMovement): string {
  return hasPackaging(movement.packaging)
    ? formatUnits(movement.packaging, Math.abs(movement.quantity))
    : "";
}

export function packagedBalanceLabel(movement: StockMovement): string {
  return formatUnits(movement.packaging, movement.balanceAfter);
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

export function parseStockMovement(raw: unknown): StockMovement {
  const m = isRecord(raw) ? raw : {};
  const product = m.product;
  const source = m.source;
  const createdBy = m.created_by;

  return {
    id: num(m.id),
    productId: isRecord(product) ? str(product.id) : str(m.product_id),
    productName: isRecord(product) ? str(product.name) : "",
    type: parseMovementType(m.movement_type),
    typeDisplay: str(m.movement_type_display),
    quantity: num(m.quantity),
    balanceAfter: num(m.balance_after),
    costPrice: num(m.cost_price),
    source: isRecord(source)
      ? {
          type: str(source.type),
          id: str(source.id),
          number: str(source.number),
        }
      : null,
    note: str(m.note),
    createdByName: isRecord(createdBy) ? str(createdBy.full_name) : "",
    createdAt: tashkentFromApi(str(m.created_at)),
    packaging: parsePackaging(isRecord(product) ? product : m),
  };
}
