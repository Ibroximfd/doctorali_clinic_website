import { parsePaymentType, type PaymentType } from "@/shared/domain/payment-type";
import { tashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/** One kind of record behind a till total. */
export interface PaymentTypeSource {
  readonly count: number;
  readonly amount: number;
}

export const EMPTY_SOURCE: PaymentTypeSource = { count: 0, amount: 0 };

/** One line in the drill-down: a sale, a service or a repayment. */
export interface PaymentTypeEntry {
  /** `order` · `treatment` · `debt_repayment`. */
  readonly kind: string;
  readonly id: string;
  /** Who it was for — the client, in every kind. */
  readonly title: string;
  /** What it was: the order number, the service name, "Qarz to'lovi". */
  readonly subtitle: string;
  readonly at: TashkentDate;
  readonly amount: number;
}

/**
 * `GET statistics/payment-type/` — everything one till took in over a period.
 *
 * The money is the server's: `total`, `gross`, `expenses` and every `sources`
 * figure are complete even when `items` is capped, which is why the app never
 * adds the rows up itself.
 */
export interface PaymentTypeIncome {
  readonly type: PaymentType;
  /** `gross − expenses`. */
  readonly total: number;
  readonly gross: number;
  readonly expenses: number;
  readonly orders: PaymentTypeSource;
  readonly treatments: PaymentTypeSource;
  readonly debtRepayments: PaymentTypeSource;
  /** Newest first, capped by the server. */
  readonly items: readonly PaymentTypeEntry[];
  /** True when `items` is only part of the period — the totals still are not. */
  readonly itemsTruncated: boolean;
}

const KIND_LABEL: Readonly<Record<string, string>> = {
  order: "Buyurtma",
  treatment: "Muolaja",
  debt_repayment: "Qarz to'lovi",
};

export function entryKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Yozuv";
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

function parseSource(raw: unknown): PaymentTypeSource {
  const s = isRecord(raw) ? raw : {};
  return { count: num(s.count), amount: num(s.amount) };
}

export function parsePaymentTypeEntry(raw: unknown): PaymentTypeEntry {
  const e = isRecord(raw) ? raw : {};
  const kind = str(e.kind);
  const number = str(e.number);
  const title = str(e.title);
  return {
    kind,
    id: str(e.id),
    title: str(e.client, "—"),
    subtitle: number !== "" ? number : title !== "" ? title : entryKindLabel(kind),
    at: tashkentFromApi(str(e.at)),
    amount: num(e.amount),
  };
}

export function parsePaymentTypeIncome(raw: unknown): PaymentTypeIncome {
  const j = isRecord(raw) ? raw : {};
  const sources = isRecord(j.sources) ? j.sources : {};
  const items = Array.isArray(j.items)
    ? j.items.filter(isRecord).map(parsePaymentTypeEntry)
    : [];
  return {
    type: parsePaymentType(j.type),
    total: num(j.total),
    gross: num(j.gross),
    expenses: num(j.expenses),
    orders: parseSource(sources.orders),
    treatments: parseSource(sources.treatments),
    debtRepayments: parseSource(sources.debt_repayments),
    items,
    itemsTruncated: j.items_truncated === true,
  };
}
