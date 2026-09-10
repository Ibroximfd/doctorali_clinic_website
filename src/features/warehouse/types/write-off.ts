import { parseProduct, type Product } from "@/features/products/types/product";
import {
  maybeTashkentFromApi,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { parseStockDocStatus, type StockDocStatus } from "./stock";

/** Why stock is being written off. */
export const WRITE_OFF_REASONS = [
  "expired",
  "damaged",
  "lost",
  "internal",
  "other",
] as const;
export type WriteOffReason = (typeof WRITE_OFF_REASONS)[number];

export function parseWriteOffReason(raw: unknown): WriteOffReason {
  return WRITE_OFF_REASONS.includes(raw as WriteOffReason)
    ? (raw as WriteOffReason)
    : "expired";
}

export const WRITE_OFF_REASON_LABEL: Readonly<Record<WriteOffReason, string>> = {
  expired: "Muddati o'tgan",
  damaged: "Buzilgan/singan",
  lost: "Yo'qolgan",
  internal: "Ichki ishlatish",
  other: "Boshqa",
};

/**
 * "Other" explains nothing on its own, so a note is mandatory — the backend
 * enforces this too, and a write-off nobody can account for later is exactly
 * what an audit trail is meant to prevent.
 */
export function reasonRequiresNote(reason: WriteOffReason): boolean {
  return reason === "other";
}

export interface StockWriteOffLine {
  readonly product: Product;
  readonly quantity: number;
}

export interface StockWriteOff {
  readonly id: string;
  readonly number: string;
  readonly reason: WriteOffReason;
  readonly note: string;
  readonly status: StockDocStatus;
  /** Value at cost — the "loss" column in reports. */
  readonly totalValue: number;
  readonly lines: readonly StockWriteOffLine[];
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  readonly confirmedAt: TashkentDate | null;
}

export function writeOffTotalUnits(doc: StockWriteOff): number {
  return doc.lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Mirrors the backend rule, so the form can block before the request. */
export function isWriteOffValid(input: {
  reason: WriteOffReason;
  note: string;
  lines: readonly StockWriteOffLine[];
}): boolean {
  return (
    input.lines.length > 0 &&
    input.lines.every((line) => line.quantity > 0) &&
    (!reasonRequiresNote(input.reason) || input.note.trim() !== "")
  );
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

export function parseStockWriteOff(raw: unknown): StockWriteOff {
  const w = isRecord(raw) ? raw : {};
  const createdBy = w.created_by;
  return {
    id: str(w.id),
    number: str(w.number),
    reason: parseWriteOffReason(w.reason),
    note: str(w.note),
    status: parseStockDocStatus(w.status),
    totalValue: num(w.total_value),
    lines: Array.isArray(w.lines)
      ? w.lines.filter(isRecord).map((l) => ({
          product: parseProduct(l.product),
          quantity: num(l.quantity),
        }))
      : [],
    createdByName: isRecord(createdBy) ? str(createdBy.full_name) : "",
    createdAt: tashkentFromApi(str(w.created_at)),
    confirmedAt:
      typeof w.confirmed_at === "string" && w.confirmed_at !== ""
        ? maybeTashkentFromApi(w.confirmed_at)
        : null,
  };
}
