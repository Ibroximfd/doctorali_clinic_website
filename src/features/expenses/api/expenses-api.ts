import type { PaymentType } from "@/shared/domain/payment-type";
import { endpoints } from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { ymd, type TashkentDate } from "@/shared/lib/format/date";

import {
  parseExpense,
  parseExpenseListResult,
  parseExpenseSummary,
  type Expense,
  type ExpenseCategory,
  type ExpenseListResult,
  type ExpenseSummary,
} from "../types/expense";

/**
 * Filters for the list and the summary — both endpoints take the same set, so
 * the two views can never disagree about which days they describe.
 */
export interface ExpenseFilter {
  /** A single day — takes precedence over the range on the API. */
  readonly date?: TashkentDate | null;
  readonly dateFrom?: TashkentDate | null;
  readonly dateTo?: TashkentDate | null;
  readonly category?: ExpenseCategory | null;
  /** Searches `note`. */
  readonly search?: string;
  /** Which till the money left. Mutually exclusive with `unspecifiedOnly`. */
  readonly paymentType?: PaymentType | null;
  /** The older records that carry no type at all. */
  readonly unspecifiedOnly?: boolean;
  /** `-expense_date` (default), `expense_date`, `-amount`, `amount`. */
  readonly ordering?: string;
}

export const EMPTY_EXPENSE_FILTER: ExpenseFilter = {
  ordering: "-expense_date",
};

export function expenseFilterQuery(filter: ExpenseFilter): Query {
  const query: Query = { ordering: filter.ordering ?? "-expense_date" };

  if (filter.date) {
    query.date = ymd(filter.date);
  } else {
    if (filter.dateFrom) query.date_from = ymd(filter.dateFrom);
    if (filter.dateTo) query.date_to = ymd(filter.dateTo);
  }
  if (filter.category) query.category = filter.category;
  if (filter.unspecifiedOnly) query.payment_type = "unspecified";
  else if (filter.paymentType) query.payment_type = filter.paymentType;
  const search = filter.search?.trim();
  if (search) query.search = search;

  return query;
}

/** A stable key for React Query. */
export function expenseFilterKey(filter: ExpenseFilter): readonly unknown[] {
  return [
    filter.date?.getTime() ?? null,
    filter.dateFrom?.getTime() ?? null,
    filter.dateTo?.getTime() ?? null,
    filter.category ?? null,
    filter.search?.trim() ?? "",
    filter.paymentType ?? null,
    filter.unspecifiedOnly ?? false,
    filter.ordering ?? "-expense_date",
  ];
}

export function fetchExpenses(input: {
  filter: ExpenseFilter;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}): Promise<ExpenseListResult> {
  return http
    .get<unknown>(endpoints.expenses, {
      query: {
        page: input.page ?? 1,
        page_size: input.pageSize ?? 20,
        ...expenseFilterQuery(input.filter),
      },
      signal: input.signal,
    })
    .then(parseExpenseListResult);
}

export function fetchExpenseSummary(
  filter: ExpenseFilter,
  signal?: AbortSignal,
): Promise<ExpenseSummary> {
  return http
    .get<unknown>(endpoints.expensesSummary, {
      query: expenseFilterQuery(filter),
      signal,
    })
    .then(parseExpenseSummary);
}

export interface ExpenseInput {
  readonly amount: number;
  readonly category: ExpenseCategory;
  readonly paymentType: PaymentType;
  readonly note?: string;
  /** Defaults to today (Asia/Tashkent) on the backend when omitted. */
  readonly expenseDate?: TashkentDate | null;
}

export function createExpense(input: ExpenseInput): Promise<Expense> {
  return http
    .post<unknown>(endpoints.expenses, {
      json: {
        amount: input.amount,
        category: input.category,
        // Which till the money leaves. The form always sends it, because an
        // expense with no type is never taken off any till in the statistics.
        payment_type: input.paymentType,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        ...(input.expenseDate ? { expense_date: ymd(input.expenseDate) } : {}),
      },
    })
    .then(parseExpense);
}

/** Partial update. Only same-day records can be edited (`canEdit`). */
export function updateExpense(
  id: string,
  patch: Partial<ExpenseInput>,
): Promise<Expense> {
  return http
    .patch<unknown>(endpoints.expense(id), {
      json: {
        ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
        ...(patch.category ? { category: patch.category } : {}),
        ...(patch.paymentType ? { payment_type: patch.paymentType } : {}),
        // A blank note is a meaningful edit (clearing it), so only `undefined`
        // is dropped.
        ...(patch.note !== undefined ? { note: patch.note.trim() } : {}),
        ...(patch.expenseDate ? { expense_date: ymd(patch.expenseDate) } : {}),
      },
    })
    .then(parseExpense);
}

/** Only same-day records can be deleted. */
export function deleteExpense(id: string): Promise<void> {
  return http.delete<void>(endpoints.expense(id));
}
