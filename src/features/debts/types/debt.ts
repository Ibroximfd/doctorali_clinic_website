import { maybeParseClientRef, type ClientRef } from "@/features/clients/types/client-ref";
import { maybeParseDoctorRef, type DoctorRef } from "@/features/doctors/types/doctor";
import { parsePaymentType, type PaymentType } from "@/shared/domain/payment-type";
import {
  dateFromYmd,
  daysBetween,
  maybeTashkentFromApi,
  nowTashkent,
  tashkentFromApi,
  ymd,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { parseFilialRef, type FilialRef } from "@/shared/domain/filial";

/**
 * Debt lifecycle (backend §6.3).
 *
 * Note what is NOT here: "overdue" is not a status but a computed property of
 * an open debt — the same rule the backend applies, so the two never disagree
 * about how many debts are open.
 */
export const DEBT_STATUSES = ["open", "partial", "paid", "cancelled"] as const;
export type DebtStatus = (typeof DEBT_STATUSES)[number];

export function parseDebtStatus(raw: unknown): DebtStatus {
  return raw === "partial" || raw === "paid" || raw === "cancelled" ? raw : "open";
}

export const DEBT_STATUS_LABEL: Readonly<Record<DebtStatus, string>> = {
  open: "Ochiq",
  partial: "Qisman to'langan",
  paid: "To'langan",
  cancelled: "Bekor qilingan",
};

/** Still owes money — the only states where paying or extending is allowed. */
export function isDebtOpen(status: DebtStatus): boolean {
  return status === "open" || status === "partial";
}

/** Which sale created the debt. */
export type DebtSource = "order" | "treatment" | "unknown";

export function parseDebtSource(raw: unknown): DebtSource {
  return raw === "order" || raw === "treatment" ? raw : "unknown";
}

export const DEBT_SOURCE_LABEL: Readonly<Record<DebtSource, string>> = {
  order: "Buyurtma",
  treatment: "Muolaja",
  unknown: "Boshqa",
};

/** The order or treatment a debt came from, as embedded in the debt payload. */
export interface DebtSourceRef {
  readonly id: string;
  /** `order_number` for an order; empty for a treatment. */
  readonly number: string;
  readonly totalAmount: number;
  /** `clinic` | `delivery`, for an order source. */
  readonly orderType: string;
  /** Treatment description, for a treatment source. */
  readonly description: string;
  readonly createdAt: TashkentDate | null;
}

/** The line reception reads in a debt row. */
export function debtSourceLabel(ref: DebtSourceRef): string {
  if (ref.number !== "") return ref.number;
  return ref.description !== "" ? ref.description : "—";
}

/** A single repayment against a debt. */
export interface DebtPaymentEntry {
  readonly id: string;
  readonly amount: number;
  readonly paymentType: PaymentType;
  readonly note: string;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
}

/**
 * Money a client still owes for an order or a treatment (backend §6.4).
 *
 * `daysLeft` and `isOverdue` come from the server rather than being derived
 * from `dueDate` locally: the clinic runs on Asia/Tashkent, the browser might
 * not, and a badge that says "Bugun" on the wrong day is worse than no badge.
 */
export interface Debt {
  /** Branch the record was made in; null on an older payload. */
  readonly filial: FilialRef | null;
  readonly id: string;
  readonly source: DebtSource;
  readonly sourceDisplay: string;
  readonly order: DebtSourceRef | null;
  readonly treatment: DebtSourceRef | null;
  readonly client: ClientRef | null;
  readonly doctor: DoctorRef | null;
  readonly amount: number;
  readonly paidAmount: number;
  readonly remaining: number;
  /** Calendar day the money is due back (no time component). */
  readonly dueDate: TashkentDate;
  /** Server-computed days until `dueDate`; negative once it has slipped. */
  readonly daysLeft: number;
  readonly isOverdue: boolean;
  readonly status: DebtStatus;
  readonly statusDisplay: string;
  /**
   * How many automatic reminders have gone out, and when the last one did. Both
   * stay at zero/null for a client without the app — which is exactly when
   * reception has to pick up the phone instead.
   */
  readonly remindersSent: number;
  readonly lastReminderAt: TashkentDate | null;
  /**
   * How many times the due date has been pushed forward. The server allows 3
   * (`due_date_extend_limit`), so the extend dialog shows "N/3".
   */
  readonly dueDateChangedCount: number;
  /** Why a written-off debt was cancelled — empty otherwise. */
  readonly cancelReason: string;
  readonly note: string;
  readonly createdByName: string;
  readonly createdAt: TashkentDate;
  readonly closedAt: TashkentDate | null;
  /** Repayment history; only the detail endpoint fills it. */
  readonly payments: readonly DebtPaymentEntry[];
}

/** The order or treatment behind this debt, whichever is set. */
export function debtSourceRef(d: Debt): DebtSourceRef | null {
  return d.order ?? d.treatment;
}

/** Can still be paid or extended. */
export function isDebtPayable(d: Debt): boolean {
  return isDebtOpen(d.status) && d.remaining > 0;
}

/** Fraction repaid, 0..1 — drives the progress bar in the detail sheet. */
export function debtPaidFraction(d: Debt): number {
  if (d.amount <= 0) return 0;
  return Math.min(1, Math.max(0, d.paidAmount / d.amount));
}

export function debtStatusLabel(d: Debt): string {
  return d.statusDisplay !== "" ? d.statusDisplay : DEBT_STATUS_LABEL[d.status];
}

export function debtSourceLabelOf(d: Debt): string {
  return d.sourceDisplay !== "" ? d.sourceDisplay : DEBT_SOURCE_LABEL[d.source];
}

// --- Parsing ----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}
function createdByName(raw: unknown): string {
  return isRecord(raw) ? str(raw.full_name) : "";
}

function parseDebtSourceRef(raw: unknown): DebtSourceRef | null {
  if (!isRecord(raw)) return null;
  return {
    id: str(raw.id),
    number: str(raw.order_number ?? raw.number),
    totalAmount: num(raw.total_amount, num(raw.amount)),
    orderType: str(raw.order_type),
    description: str(raw.description),
    createdAt: maybeTashkentFromApi(
      typeof raw.created_at === "string" ? raw.created_at : null,
    ),
  };
}

function parseDebtPayment(raw: unknown): DebtPaymentEntry {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(p.id),
    amount: num(p.amount),
    paymentType: parsePaymentType(p.payment_type),
    note: str(p.note),
    createdByName: createdByName(p.created_by),
    createdAt: tashkentFromApi(str(p.created_at)),
  };
}

export function parseDebt(raw: unknown): Debt {
  const d = (raw ?? {}) as Record<string, unknown>;
  const amount = num(d.amount);
  const paid = num(d.paid_amount);
  const status = parseDebtStatus(d.status);
  // `remaining` and `days_left` are server-computed; recomputed only as a
  // fallback so an older payload still renders sane numbers.
  const remaining = typeof d.remaining === "number" ? d.remaining : amount - paid;
  const dueDate = dateFromYmd(str(d.due_date));
  const daysLeft =
    typeof d.days_left === "number" ? d.days_left : daysBetween(nowTashkent(), dueDate);

  return {
    filial: parseFilialRef(d.filial),
    id: str(d.id),
    source: parseDebtSource(d.source),
    sourceDisplay: str(d.source_display),
    order: parseDebtSourceRef(d.order),
    treatment: parseDebtSourceRef(d.treatment),
    client: maybeParseClientRef(d.client),
    doctor: maybeParseDoctorRef(d.doctor),
    amount,
    paidAmount: paid,
    remaining: remaining < 0 ? 0 : remaining,
    dueDate,
    daysLeft,
    isOverdue:
      typeof d.is_overdue === "boolean"
        ? d.is_overdue
        : isDebtOpen(status) && daysLeft < 0,
    status,
    statusDisplay: str(d.status_display),
    remindersSent: num(d.reminders_sent),
    lastReminderAt: maybeTashkentFromApi(
      typeof d.last_reminder_at === "string" ? d.last_reminder_at : null,
    ),
    dueDateChangedCount: num(d.due_date_changed_count),
    cancelReason: str(d.cancel_reason),
    note: str(d.note),
    createdByName: createdByName(d.created_by),
    createdAt: tashkentFromApi(str(d.created_at)),
    closedAt: maybeTashkentFromApi(typeof d.closed_at === "string" ? d.closed_at : null),
    payments: Array.isArray(d.payments) ? d.payments.map(parseDebtPayment) : [],
  };
}

export function maybeParseDebt(raw: unknown): Debt | null {
  return isRecord(raw) ? parseDebt(raw) : null;
}

export function parseDebtList(raw: unknown): Debt[] {
  return Array.isArray(raw) ? raw.filter(isRecord).map(parseDebt) : [];
}

/**
 * The `debt` block sent when part of a sale goes on credit.
 *
 * Shared verbatim by `POST orders/` and `POST treatments/` — the backend takes
 * the same object in both places, so there is one type for it rather than two
 * that can drift apart.
 */
export interface DebtDraft {
  /** So'm going on credit. Must be > 0 and ≤ the sale total. */
  readonly amount: number;
  /** When the client promised to bring it. Mandatory, and never in the past. */
  readonly dueDate: TashkentDate;
  readonly note: string;
}

export function debtDraftToJson(draft: DebtDraft): Record<string, unknown> {
  return {
    amount: draft.amount,
    due_date: ymd(draft.dueDate),
    ...(draft.note.trim() !== "" ? { note: draft.note.trim() } : {}),
  };
}
