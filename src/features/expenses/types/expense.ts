import {
  parseOptionalPaymentType,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import {
  dateFromYmd,
  tashkentFromApi,
  type TashkentDate,
} from "@/shared/lib/format/date";

/**
 * Expense categories. `other` is the API's default when `category` is omitted.
 */
export const EXPENSE_CATEGORIES = [
  "supplies",
  "utilities",
  "salary",
  "rent",
  "transport",
  "repair",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function parseExpenseCategory(raw: unknown): ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(raw as ExpenseCategory)
    ? (raw as ExpenseCategory)
    : "other";
}

export const EXPENSE_CATEGORY_LABEL: Readonly<Record<ExpenseCategory, string>> = {
  supplies: "Materiallar/oziq-ovqat",
  utilities: "Kommunal",
  salary: "Ish haqi",
  rent: "Ijara",
  transport: "Transport",
  repair: "Ta'mirlash",
  other: "Boshqa",
};

/** A single daily expense record. */
export interface Expense {
  readonly id: string;
  readonly amount: number;
  readonly category: ExpenseCategory;
  readonly categoryDisplay: string;
  readonly note: string;
  /** The day this expense belongs to (bare date, no time). */
  readonly expenseDate: TashkentDate;
  readonly createdBy: string;
  /**
   * True only while the expense was entered today — the backend locks edit and
   * delete after that, so the buttons are hidden rather than offered and
   * refused.
   */
  readonly canEdit: boolean;
  readonly createdAt: TashkentDate;
  /**
   * Which till the money left, or null for older records entered before the
   * field existed. A null one is still counted in the day's total — it simply
   * can't be taken off any single till, which is why the form now insists on a
   * choice.
   */
  readonly paymentType: PaymentType | null;
  readonly paymentTypeDisplay: string;
}

/** What to show in a list row: the server's word, then our own. */
export function expensePaymentLabel(e: Expense): string {
  if (e.paymentTypeDisplay !== "") return e.paymentTypeDisplay;
  return e.paymentType ? PAYMENT_TYPE_LABEL[e.paymentType] : "Belgilanmagan";
}

export function expenseCategoryLabel(e: Expense): string {
  return e.categoryDisplay !== ""
    ? e.categoryDisplay
    : EXPENSE_CATEGORY_LABEL[e.category];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

export function parseExpense(raw: unknown): Expense {
  const e = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(e.id),
    amount: num(e.amount),
    category: parseExpenseCategory(e.category),
    categoryDisplay: str(e.category_display),
    note: str(e.note),
    expenseDate: dateFromYmd(str(e.expense_date)),
    createdBy: str(e.created_by),
    canEdit: e.can_edit === true,
    createdAt: tashkentFromApi(str(e.created_at)),
    // "" means the record predates the field — never fold that into cash.
    paymentType: parseOptionalPaymentType(e.payment_type),
    paymentTypeDisplay: str(e.payment_type_display),
  };
}

/** One category's aggregate within a summary. */
export interface ExpenseCategoryAmount {
  readonly category: ExpenseCategory;
  readonly categoryDisplay: string;
  readonly amount: number;
  readonly count: number;
}

/**
 * One till's aggregate (`by_payment_type`). `paymentType` is null for the
 * `"unspecified"` row — older records that count towards the day's total but
 * come off no till.
 */
export interface ExpensePaymentAmount {
  readonly paymentType: PaymentType | null;
  readonly paymentTypeDisplay: string;
  readonly amount: number;
  readonly count: number;
}

export function paymentAmountLabel(row: ExpensePaymentAmount): string {
  if (row.paymentTypeDisplay !== "") return row.paymentTypeDisplay;
  return row.paymentType ? PAYMENT_TYPE_LABEL[row.paymentType] : "Belgilanmagan";
}

/** `GET expenses/summary/` — turkum bo'yicha jami xarajatlar. */
export interface ExpenseSummary {
  readonly totalAmount: number;
  readonly count: number;
  readonly byCategory: readonly ExpenseCategoryAmount[];
  /** Same total split by till; empty on a backend that doesn't send it yet. */
  readonly byPaymentType: readonly ExpensePaymentAmount[];
}

export const EMPTY_EXPENSE_SUMMARY: ExpenseSummary = {
  totalAmount: 0,
  count: 0,
  byCategory: [],
  byPaymentType: [],
};

export function parseExpenseSummary(raw: unknown): ExpenseSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    totalAmount: num(s.total_amount),
    count: num(s.count),
    byCategory: Array.isArray(s.by_category)
      ? s.by_category.map((row) => {
          const r = (row ?? {}) as Record<string, unknown>;
          return {
            category: parseExpenseCategory(r.category),
            categoryDisplay: str(r.category_display),
            amount: num(r.amount),
            count: num(r.count),
          };
        })
      : [],
    byPaymentType: Array.isArray(s.by_payment_type)
      ? s.by_payment_type.map((row) => {
          const r = (row ?? {}) as Record<string, unknown>;
          return {
            paymentType: parseOptionalPaymentType(r.payment_type),
            paymentTypeDisplay: str(r.payment_type_display),
            amount: num(r.amount),
            count: num(r.count),
          };
        })
      : [],
  };
}

/**
 * A page of `GET expenses/` — the DRF envelope plus `totalAmount`, the sum of
 * the ENTIRE filtered set (not just this page).
 */
export interface ExpenseListResult {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly Expense[];
  readonly totalAmount: number;
}

export function parseExpenseListResult(raw: unknown): ExpenseListResult {
  const j = (raw ?? {}) as Record<string, unknown>;
  const results = Array.isArray(j.results) ? j.results.map(parseExpense) : [];
  return {
    count: num(j.count, results.length),
    next: typeof j.next === "string" ? j.next : null,
    previous: typeof j.previous === "string" ? j.previous : null,
    results,
    totalAmount: num(j.total_amount),
  };
}
