import {
  dateFromYmd,
  maybeTashkentFromApi,
  tashkentFromApi,
  ymd,
  type TashkentDate,
} from "@/shared/lib/format/date";

/** Doctor reference embedded in every payout payload. */
export interface PayoutDoctor {
  readonly id: number;
  readonly fullName: string;
  readonly specialty: string;
  readonly avatarUrl: string | null;
}

/** Where a commission originated. */
export type PayoutSource = "reception" | "doctor" | "unknown";

export const PAYOUT_SOURCE_LABEL: Readonly<Record<PayoutSource, string>> = {
  reception: "Showroom",
  doctor: "Ilova",
  unknown: "—",
};

export type PayoutStatus = "paid" | "cancelled" | "unknown";

export const PAYOUT_STATUS_LABEL: Readonly<Record<PayoutStatus, string>> = {
  paid: "To'langan",
  cancelled: "Bekor qilingan",
  unknown: "—",
};

/**
 * How a weekly payout figure should read.
 *
 * A week can come out **negative**: when an order is edited or cancelled after
 * its commission was already paid, the difference is withheld from the next
 * week — and if that week earned less than the amount being withheld, the
 * doctor ends it owing the clinic, and the debt rolls forward again.
 *
 * That is a normal state, not an error, so the app NAMES it rather than
 * printing a minus sign and leaving the desk to work it out.
 */
export type PayoutBalance = "owed_to_doctor" | "settled" | "owed_by_doctor";

export function balanceOf(amount: number): PayoutBalance {
  if (amount < 0) return "owed_by_doctor";
  if (amount === 0) return "settled";
  return "owed_to_doctor";
}

export function balanceCaption(balance: PayoutBalance): string {
  return balance === "owed_by_doctor" ? "Shifokor qarzi" : "Jami komissiya";
}

export function balanceExplanation(balance: PayoutBalance): string | null {
  return balance === "owed_by_doctor"
    ? "Bu haftada ushlanadigan summa ishlangan komissiyadan ko'p — farq keyingi haftaga o'tadi."
    : null;
}

/** One product line inside a commission-bearing order (drill-down leaf). */
export interface PayoutItem {
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly lineTotal: number;
  readonly commissionAmount: number;
  readonly commissionPercent: number;
}

/** One order within a payout day, with the commission it contributed. */
export interface PayoutOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly source: PayoutSource;
  readonly createdAt: TashkentDate;
  readonly orderCommission: number;
  readonly items: readonly PayoutItem[];
}

/**
 * A correction booked against a payout week.
 *
 * It appears when an order is edited, cancelled or deleted **after** its
 * commission was already paid out: the difference can no longer be taken back
 * from that week, so it is withheld from this one. A negative amount is the
 * normal case — money coming off what the doctor is owed.
 */
export interface PayoutAdjustment {
  readonly amount: number;
  readonly label: string;
  readonly orderNumber: string | null;
  readonly at: TashkentDate | null;
}

/** One calendar day of a payout week. */
export interface PayoutDay {
  readonly date: TashkentDate;
  readonly dayCommission: number;
  readonly orders: readonly PayoutOrder[];
  readonly adjustments: readonly PayoutAdjustment[];
}

/** One unpaid week bucket for a doctor (Monday–Sunday). */
export interface OutstandingWeek {
  readonly weekStart: TashkentDate;
  readonly weekEnd: TashkentDate;
  readonly totalAmount: number;
  readonly commissionCount: number;
}

/** The `YYYY-MM-DD` Monday string the pay/week endpoints expect. */
export function weekStartApi(week: { weekStart: TashkentDate }): string {
  return ymd(week.weekStart);
}

export interface OutstandingDoctor {
  readonly doctor: PayoutDoctor;
  readonly totalUnpaid: number;
  readonly weeksCount: number;
  readonly weeks: readonly OutstandingWeek[];
}

export interface OutstandingResponse {
  readonly doctors: readonly OutstandingDoctor[];
  readonly grandTotal: number;
}

/** Everything sold in one week for a doctor, opened day → order → product. */
export interface WeekDetail {
  readonly doctor: PayoutDoctor;
  readonly weekStart: TashkentDate;
  readonly weekEnd: TashkentDate;
  readonly totalAmount: number;
  readonly commissionCount: number;
  readonly isPaid: boolean;
  readonly payoutId: string | null;
  readonly days: readonly PayoutDay[];
}

/** A weekly payout record. */
export interface Payout {
  readonly id: string;
  readonly doctor: PayoutDoctor;
  readonly weekStart: TashkentDate;
  readonly weekEnd: TashkentDate;
  readonly totalAmount: number;
  readonly commissionCount: number;
  readonly status: PayoutStatus;
  readonly note: string;
  readonly createdAt: TashkentDate;
  readonly paidByName: string;
  readonly paidAt: TashkentDate | null;
  readonly cancelledAt: TashkentDate | null;
  readonly cancelledReason: string;
  /** Only the single-payout drill-down fills this; list rows leave it empty. */
  readonly days: readonly PayoutDay[];
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

export function parsePayoutDoctor(raw: unknown): PayoutDoctor {
  const d = isRecord(raw) ? raw : {};
  return {
    id: num(d.id),
    fullName: str(d.full_name),
    specialty: str(d.specialty),
    avatarUrl: typeof d.avatar_url === "string" ? d.avatar_url : null,
  };
}

function parsePayoutSource(raw: unknown): PayoutSource {
  return raw === "reception" || raw === "doctor" ? raw : "unknown";
}

function parsePayoutItem(raw: unknown): PayoutItem {
  const i = isRecord(raw) ? raw : {};
  return {
    productName: str(i.product_name),
    quantity: num(i.quantity),
    unitPrice: num(i.unit_price),
    lineTotal: num(i.line_total),
    commissionAmount: num(i.commission_amount),
    commissionPercent: num(i.commission_percent),
  };
}

function parsePayoutOrder(raw: unknown): PayoutOrder {
  const o = isRecord(raw) ? raw : {};
  return {
    orderId: str(o.order_id),
    orderNumber: str(o.order_number),
    source: parsePayoutSource(o.source),
    createdAt: tashkentFromApi(str(o.created_at)),
    orderCommission: num(o.order_commission),
    items: Array.isArray(o.items) ? o.items.map(parsePayoutItem) : [],
  };
}

/**
 * The adjustments list arrived after the screens that show it, so the parse is
 * deliberately forgiving about names: a row with an amount but an unfamiliar
 * label is still worth printing.
 */
function parsePayoutAdjustment(raw: unknown): PayoutAdjustment {
  const a = isRecord(raw) ? raw : {};
  const pickNum = (keys: readonly string[]) => {
    for (const key of keys) {
      const value = a[key];
      if (typeof value === "number") return value;
    }
    return 0;
  };
  const pickStr = (keys: readonly string[]) => {
    for (const key of keys) {
      const value = a[key];
      if (typeof value === "string" && value.trim() !== "") return value.trim();
    }
    return null;
  };
  const at = pickStr(["created_at", "date", "at"]);
  return {
    amount: pickNum(["amount", "commission_amount", "delta", "value"]),
    label:
      pickStr(["reason", "description", "label", "type_display", "note", "type"]) ??
      "Tuzatish",
    orderNumber: pickStr(["order_number", "number"]),
    at: at === null ? null : tashkentFromApi(at),
  };
}

export function parsePayoutDay(raw: unknown): PayoutDay {
  const d = isRecord(raw) ? raw : {};
  return {
    date: dateFromYmd(str(d.date)),
    dayCommission: num(d.day_commission),
    orders: Array.isArray(d.orders) ? d.orders.map(parsePayoutOrder) : [],
    adjustments: Array.isArray(d.adjustments)
      ? d.adjustments.map(parsePayoutAdjustment)
      : [],
  };
}

export function parseOutstanding(raw: unknown): OutstandingResponse {
  const r = isRecord(raw) ? raw : {};
  return {
    grandTotal: num(r.grand_total),
    doctors: Array.isArray(r.doctors)
      ? r.doctors.map((entry) => {
          const d = isRecord(entry) ? entry : {};
          return {
            doctor: parsePayoutDoctor(d.doctor),
            totalUnpaid: num(d.total_unpaid),
            weeksCount: num(d.weeks_count),
            weeks: Array.isArray(d.weeks)
              ? d.weeks.map((w) => {
                  const week = isRecord(w) ? w : {};
                  return {
                    weekStart: dateFromYmd(str(week.week_start)),
                    weekEnd: dateFromYmd(str(week.week_end)),
                    totalAmount: num(week.total_amount),
                    commissionCount: num(week.commission_count),
                  };
                })
              : [],
          };
        })
      : [],
  };
}

export function parseWeekDetail(raw: unknown): WeekDetail {
  const w = isRecord(raw) ? raw : {};
  return {
    doctor: parsePayoutDoctor(w.doctor),
    weekStart: dateFromYmd(str(w.week_start)),
    weekEnd: dateFromYmd(str(w.week_end)),
    totalAmount: num(w.total_amount),
    commissionCount: num(w.commission_count),
    isPaid: w.is_paid === true,
    payoutId:
      w.payout_id === null || w.payout_id === undefined ? null : String(w.payout_id),
    days: Array.isArray(w.days) ? w.days.map(parsePayoutDay) : [],
  };
}

export function parsePayout(raw: unknown): Payout {
  const p = isRecord(raw) ? raw : {};
  const paidBy = isRecord(p.paid_by) ? p.paid_by : {};
  const status = p.status === "paid" || p.status === "cancelled" ? p.status : "unknown";
  return {
    id: str(p.id),
    doctor: parsePayoutDoctor(p.doctor),
    weekStart: dateFromYmd(str(p.week_start)),
    weekEnd: dateFromYmd(str(p.week_end)),
    totalAmount: num(p.total_amount),
    commissionCount: num(p.commission_count),
    status,
    note: str(p.note),
    createdAt: tashkentFromApi(str(p.created_at)),
    paidByName: str(paidBy.full_name),
    paidAt: maybeTashkentFromApi(typeof p.paid_at === "string" ? p.paid_at : null),
    cancelledAt: maybeTashkentFromApi(
      typeof p.cancelled_at === "string" ? p.cancelled_at : null,
    ),
    cancelledReason: str(p.cancelled_reason),
    days: Array.isArray(p.days) ? p.days.map(parsePayoutDay) : [],
  };
}
