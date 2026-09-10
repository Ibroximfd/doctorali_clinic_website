/** One client near the top of the outstanding-debt list. */
export interface TopDebtor {
  readonly clientId: number;
  readonly fullName: string;
  readonly phone: string;
  readonly amount: number;
}

/**
 * The KPI block above the debts page.
 *
 * Four figures reception acts on: what is outstanding, what has slipped, what
 * falls due today, and what has actually been collected today.
 */
export interface DebtSummary {
  readonly openCount: number;
  readonly openAmount: number;
  readonly overdueCount: number;
  readonly overdueAmount: number;
  readonly dueTodayCount: number;
  readonly dueTodayAmount: number;
  readonly dueWeekCount: number;
  readonly dueWeekAmount: number;
  /** Repayments taken in today / this month — what reception is measured on. */
  readonly collectedToday: number;
  readonly collectedMonth: number;
  /** New credit extended this month. */
  readonly issuedMonth: number;
  readonly topDebtors: readonly TopDebtor[];
}

export const EMPTY_DEBT_SUMMARY: DebtSummary = {
  openCount: 0,
  openAmount: 0,
  overdueCount: 0,
  overdueAmount: 0,
  dueTodayCount: 0,
  dueTodayAmount: 0,
  dueWeekCount: 0,
  dueWeekAmount: 0,
  collectedToday: 0,
  collectedMonth: 0,
  issuedMonth: 0,
  topDebtors: [],
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown): string {
  return v === null || v === undefined ? "" : String(v);
}

export function parseDebtSummary(raw: unknown): DebtSummary {
  const s = (raw ?? {}) as Record<string, unknown>;
  return {
    openCount: num(s.open_count),
    openAmount: num(s.open_amount),
    overdueCount: num(s.overdue_count),
    overdueAmount: num(s.overdue_amount),
    dueTodayCount: num(s.due_today_count),
    dueTodayAmount: num(s.due_today_amount),
    dueWeekCount: num(s.due_week_count),
    dueWeekAmount: num(s.due_week_amount),
    collectedToday: num(s.collected_today),
    collectedMonth: num(s.collected_month),
    issuedMonth: num(s.issued_month),
    topDebtors: Array.isArray(s.top_debtors)
      ? s.top_debtors.map((row) => {
          const r = (row ?? {}) as Record<string, unknown>;
          return {
            clientId: num(r.client_id),
            fullName: str(r.full_name),
            phone: str(r.phone),
            amount: num(r.amount),
          };
        })
      : [],
  };
}
