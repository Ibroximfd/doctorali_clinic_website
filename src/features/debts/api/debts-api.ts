import type { PaymentType } from "@/shared/domain/payment-type";
import {
  CONFIRM_PIN_HEADER,
  IDEMPOTENCY_HEADER,
  endpoints,
} from "@/shared/lib/api/endpoints";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";
import { nowTashkent, ymd, type TashkentDate } from "@/shared/lib/format/date";
import { uuidV4 } from "@/shared/lib/uuid";

import { parseDebt, type Debt, type DebtSource } from "../types/debt";
import { parseDebtSummary, type DebtSummary } from "../types/debt-summary";

/**
 * The ready-made views above the list, matching the four KPI tiles — tapping a
 * tile applies its filter.
 */
export const DEBT_VIEWS = ["open", "overdue", "dueToday", "paid", "all"] as const;
export type DebtView = (typeof DEBT_VIEWS)[number];

export const DEBT_VIEW_LABEL: Readonly<Record<DebtView, string>> = {
  open: "Ochiq",
  overdue: "Kechikkan",
  dueToday: "Bugun muddati",
  paid: "To'langan",
  all: "Hammasi",
};

export interface DebtFilter {
  readonly view: DebtView;
  /** Client name / phone / order number. */
  readonly search?: string;
  readonly source?: DebtSource | null;
  readonly doctorId?: string | null;
  readonly clientId?: number | null;
  readonly dueFrom?: TashkentDate | null;
  readonly dueTo?: TashkentDate | null;
  /** Default puts the nearest deadline first — the order reception works in. */
  readonly ordering?: string;
}

export const DEFAULT_DEBT_FILTER: DebtFilter = {
  view: "open",
  ordering: "due_date",
};

/**
 * The `status` a view expands to.
 *
 * Only the documented catalog values are ever sent: `active` (anything still
 * owed — open + partial), `overdue`, `paid`. A home-made value like
 * `open,partial` would either 400 on a validating backend or silently return
 * the wrong list.
 */
function viewParams(view: DebtView): Query {
  const today = ymd(nowTashkent());
  switch (view) {
    case "open":
      return { status: "active" };
    case "overdue":
      return { status: "overdue" };
    case "dueToday":
      return { status: "active", due_from: today, due_to: today };
    case "paid":
      return { status: "paid" };
    case "all":
      return {};
  }
}

export function debtFilterQuery(filter: DebtFilter): Query {
  return {
    ...viewParams(filter.view),
    ...(filter.search?.trim() ? { search: filter.search.trim() } : {}),
    ...(filter.source && filter.source !== "unknown" ? { source: filter.source } : {}),
    ...(filter.doctorId ? { doctor_id: filter.doctorId } : {}),
    ...(filter.clientId ? { client_id: filter.clientId } : {}),
    // An explicit range wins over the one the view implies.
    ...(filter.dueFrom ? { due_from: ymd(filter.dueFrom) } : {}),
    ...(filter.dueTo ? { due_to: ymd(filter.dueTo) } : {}),
    ordering: filter.ordering ?? "due_date",
  };
}

export function debtFilterKey(filter: DebtFilter): readonly unknown[] {
  return [
    filter.view,
    filter.search?.trim() ?? "",
    filter.source ?? null,
    filter.doctorId ?? null,
    filter.clientId ?? null,
    filter.dueFrom?.getTime() ?? null,
    filter.dueTo?.getTime() ?? null,
    filter.ordering ?? "due_date",
  ];
}

export function fetchDebts(input: {
  filter: DebtFilter;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<Debt>> {
  return http
    .get<unknown>(endpoints.debts, {
      query: { page: input.page ?? 1, ...debtFilterQuery(input.filter) },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseDebt));
}

export function fetchDebtSummary(signal?: AbortSignal): Promise<DebtSummary> {
  return http.get<unknown>(endpoints.debtsSummary, { signal }).then(parseDebtSummary);
}

/** `GET debts/{id}/` — detail including the repayment history. */
export function fetchDebt(id: string, signal?: AbortSignal): Promise<Debt> {
  return http
    .get<Record<string, unknown>>(endpoints.debt(id), { signal })
    .then((data) => parseDebt(unwrap(data, "debt")));
}

export interface PayDebtInput {
  readonly amount: number;
  /** How the client handed it over — this lands in today's till breakdown. */
  readonly paymentType: PaymentType;
  readonly note?: string;
  /**
   * Taking the same repayment twice is exactly the mistake that makes a
   * balance wrong, so every attempt carries one stable key (§11.2).
   */
  readonly idempotencyKey?: string;
}

export function payDebt(id: string, input: PayDebtInput): Promise<Debt> {
  return http
    .post<Record<string, unknown>>(endpoints.debtPay(id), {
      json: {
        amount: input.amount,
        payment_type: input.paymentType,
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      },
      headers: { [IDEMPOTENCY_HEADER]: input.idempotencyKey ?? uuidV4() },
    })
    .then((data) => parseDebt(unwrap(data, "debt")));
}

/**
 * `PATCH debts/{id}/` — extends the deadline and/or edits the note.
 *
 * The backend only allows moving a due date **forward**, and refuses a fourth
 * extension without an admin (`due_date_extend_limit`).
 */
export function updateDebt(
  id: string,
  patch: { dueDate?: TashkentDate; note?: string },
): Promise<Debt> {
  return http
    .patch<Record<string, unknown>>(endpoints.debt(id), {
      json: {
        ...(patch.dueDate ? { due_date: ymd(patch.dueDate) } : {}),
        ...(patch.note !== undefined ? { note: patch.note.trim() } : {}),
      },
    })
    .then((data) => parseDebt(unwrap(data, "debt")));
}

/**
 * `POST debts/{id}/cancel/` — writes the debt off. Admin only; the reason is
 * mandatory and ends up in the audit log.
 */
export function cancelDebt(
  id: string,
  input: { reason: string; confirmPin?: string },
): Promise<Debt> {
  return http
    .post<Record<string, unknown>>(endpoints.debtCancel(id), {
      json: { reason: input.reason.trim() },
      headers: input.confirmPin ? { [CONFIRM_PIN_HEADER]: input.confirmPin } : undefined,
    })
    .then((data) => parseDebt(unwrap(data, "debt")));
}

/** `GET debts/export/` — the current filter as an `.xlsx` workbook. */
export function exportDebts(filter: DebtFilter) {
  return http.blob(endpoints.debtsExport, {
    query: debtFilterQuery(filter),
    fallbackFileName: "qarzlar.xlsx",
  });
}

/**
 * Tolerates either a bare debt object or one wrapped as `{ "debt": {…} }` —
 * the action endpoints aren't explicit about which they return.
 */
function unwrap(data: Record<string, unknown> | null, key: string): unknown {
  if (!data) return {};
  const nested = data[key];
  return typeof nested === "object" && nested !== null ? nested : data;
}
