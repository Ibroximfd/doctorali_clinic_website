import { parseDebt, type Debt } from "@/features/debts/types/debt";
import { parseExpense, type Expense } from "@/features/expenses/types/expense";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import {
  maybeTashkentFromApi,
  nowTashkent,
  ymd,
  type TashkentDate,
} from "@/shared/lib/format/date";

/**
 * The end-of-shift summary.
 *
 * The numbers reception hands over at the end of the day: what came into the
 * till and how, what went out on credit, and what is booked for tomorrow. The
 * same figures reach the boss's Telegram at 21:00, so this screen and that
 * report must always agree — every key here matches the backend's name.
 */
export interface DailyClosingReport {
  /** `YYYY-MM-DD` the report covers. */
  readonly date: string;
  readonly ordersCount: number;
  readonly ordersRevenue: number;
  readonly clinicOrders: number;
  readonly deliveryOrders: number;
  readonly treatmentsCount: number;
  readonly servicesRevenue: number;
  /** The single most important figure: cash actually taken today. */
  readonly totalCollected: number;
  /** Gross cash-in per till. */
  readonly paymentBreakdown: ReadonlyMap<PaymentType, number>;
  /**
   * What left each till. The `null` key is the server's `unspecified` bucket —
   * spending that belongs to no single drawer, kept on its own rather than
   * folded into cash, which would misstate the count.
   */
  readonly expenseBreakdown: ReadonlyMap<PaymentType | null, number>;
  /** What should be left in each till. SERVER-COMPUTED — printed, not derived. */
  readonly netBreakdown: ReadonlyMap<PaymentType, number>;
  /** The notes that must physically be in the drawer. */
  readonly cashOnHand: number | null;
  /** The day's spending, itemised, when the server sends it inline. */
  readonly expensesList: readonly Expense[];
  readonly expenses: number;
  readonly net: number;
  readonly debtIssued: number;
  readonly debtCollected: number;
  readonly debtOutstanding: number;
  readonly debtOverdue: number;
  readonly issuedDebts: readonly Debt[];
  readonly openDebts: readonly Debt[];
  readonly openDebtsCount: number;
  readonly noShowCount: number;
  /** What is booked for tomorrow — the reason to read this before leaving. */
  readonly tomorrowAppointments: number;
  /** Messages that failed today; each one is a client to phone instead. */
  readonly failedNotifications: number;

  readonly closed: boolean;
  readonly closedAt: TashkentDate | null;
  readonly closedBy: string;
  /** What was actually counted in the drawer at hand-over. */
  readonly countedCash: number | null;
  /** `counted_cash − expected_cash`. NEGATIVE MEANS SHORT. */
  readonly cashDifference: number | null;
  /**
   * True when the day changed after it was closed — a backdated order landed on
   * it, so the figure the shift signed for is no longer the current one.
   */
  readonly reopened: boolean;
}

/** One till's day: what came in, what left, and what should still be there. */
export interface TillLine {
  /** Null is the "Belgilanmagan" row — money spent without a till recorded. */
  readonly type: PaymentType | null;
  readonly collected: number;
  readonly spent: number;
  readonly net: number;
}

export function tillLabel(line: TillLine): string {
  return line.type === null ? "Belgilanmagan" : PAYMENT_TYPE_LABEL[line.type];
}

/**
 * The per-till lines.
 *
 * The arithmetic belongs to the backend: `net_breakdown` wins wherever it is
 * present, and the subtraction below is only the stand-in used until it ships.
 */
export function tillLines(report: DailyClosingReport): TillLine[] {
  const lines: TillLine[] = PAYMENT_TYPES.map((type) => {
    const collected = report.paymentBreakdown.get(type) ?? 0;
    const spent = report.expenseBreakdown.get(type) ?? 0;
    return {
      type,
      collected,
      spent,
      net: report.netBreakdown.get(type) ?? collected - spent,
    };
  });

  const unattributed = report.expenseBreakdown.get(null) ?? 0;
  if (unattributed > 0) {
    lines.push({
      type: null,
      collected: 0,
      spent: unattributed,
      net: -unattributed,
    });
  }
  return lines;
}

/**
 * What the cash drawer itself should hold — the one figure a handover is
 * actually checked against. Server-sent; derived only as a fallback.
 */
export function expectedCash(report: DailyClosingReport): number {
  if (report.cashOnHand !== null) return report.cashOnHand;
  return tillLines(report)
    .filter((line) => line.type === "cash")
    .reduce((sum, line) => sum + line.net, 0);
}

export function emptyDailyClosing(): DailyClosingReport {
  return {
    date: ymd(nowTashkent()),
    ordersCount: 0,
    ordersRevenue: 0,
    clinicOrders: 0,
    deliveryOrders: 0,
    treatmentsCount: 0,
    servicesRevenue: 0,
    totalCollected: 0,
    paymentBreakdown: new Map(),
    expenseBreakdown: new Map(),
    netBreakdown: new Map(),
    cashOnHand: null,
    expensesList: [],
    expenses: 0,
    net: 0,
    debtIssued: 0,
    debtCollected: 0,
    debtOutstanding: 0,
    debtOverdue: 0,
    issuedDebts: [],
    openDebts: [],
    openDebtsCount: 0,
    noShowCount: 0,
    tomorrowAppointments: 0,
    failedNotifications: 0,
    closed: false,
    closedAt: null,
    closedBy: "",
    countedCash: null,
    cashDifference: null,
    reopened: false,
  };
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

/**
 * Only the three documented physical channels are named. An unknown key must
 * never be folded into "cash" — that would misstate the drawer — so anything
 * unrecognised is skipped.
 */
function parseBreakdown(raw: unknown): ReadonlyMap<PaymentType, number> {
  const result = new Map<PaymentType, number>();
  if (!isRecord(raw)) return result;
  for (const [key, value] of Object.entries(raw)) {
    if (!PAYMENT_TYPES.includes(key as PaymentType)) continue;
    const amount = num(value);
    if (amount <= 0) continue;
    result.set(key as PaymentType, amount);
  }
  return result;
}

/** Like the above, but keeps the server's `unspecified` bucket under `null`. */
function parseSpendBreakdown(raw: unknown): ReadonlyMap<PaymentType | null, number> {
  const result = new Map<PaymentType | null, number>();
  if (!isRecord(raw)) return result;
  for (const [key, value] of Object.entries(raw)) {
    const amount = num(value);
    if (amount <= 0) continue;
    const known = PAYMENT_TYPES.includes(key as PaymentType);
    if (!known && key !== "unspecified") continue;
    const mapKey = known ? (key as PaymentType) : null;
    result.set(mapKey, (result.get(mapKey) ?? 0) + amount);
  }
  return result;
}

/** One bad row must not cost the desk its whole end-of-day sheet. */
function parseList<T>(raw: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(raw)) return [];
  const result: T[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    try {
      result.push(parse(item));
    } catch {
      continue;
    }
  }
  return result;
}

export function parseDailyClosing(raw: unknown): DailyClosingReport {
  const j = isRecord(raw) ? raw : {};
  const byType = isRecord(j.orders_by_type) ? j.orders_by_type : {};
  const totalCollected = num(j.total_collected);
  const expenses = optNum(j.expenses) ?? num(j.expenses_total);
  const openDebts = parseList(j.debts_open_list, parseDebt);
  const closedBy = j.closed_by;

  return {
    date: typeof j.date === "string" && j.date !== "" ? j.date : ymd(nowTashkent()),
    ordersCount: num(j.orders_count),
    ordersRevenue: optNum(j.orders_revenue) ?? num(j.orders_total),
    clinicOrders: num(byType.clinic),
    deliveryOrders: num(byType.delivery),
    treatmentsCount: num(j.treatments_count),
    servicesRevenue: optNum(j.services_revenue) ?? num(j.treatments_total),
    totalCollected,
    paymentBreakdown: parseBreakdown(j.payment_breakdown),
    expenseBreakdown: parseSpendBreakdown(j.expense_breakdown),
    netBreakdown: parseBreakdown(j.net_breakdown),
    cashOnHand: optNum(j.cash_on_hand),
    expensesList: parseList(j.expenses_list, parseExpense),
    expenses,
    net: optNum(j.net) ?? totalCollected - expenses,
    debtIssued: num(j.debt_issued),
    debtCollected: num(j.debt_collected),
    debtOutstanding: num(j.debt_outstanding),
    debtOverdue: num(j.debt_overdue),
    issuedDebts: parseList(j.debts_issued_list, parseDebt),
    openDebts,
    openDebtsCount: optNum(j.debts_open_count) ?? openDebts.length,
    noShowCount: optNum(j.no_show_count) ?? num(j.visits_no_show),
    tomorrowAppointments: num(j.tomorrow_appointments),
    failedNotifications: num(j.failed_notifications),
    closed: j.closed === true,
    closedAt:
      typeof j.closed_at === "string" && j.closed_at !== ""
        ? maybeTashkentFromApi(j.closed_at)
        : null,
    closedBy: isRecord(closedBy) ? String(closedBy.full_name ?? "") : "",
    countedCash: optNum(j.counted_cash),
    cashDifference: optNum(j.cash_difference),
    reopened: j.reopened === true,
  };
}
