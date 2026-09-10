import { parsePaymentType, type PaymentType } from "@/shared/domain/payment-type";
import { maybeTashkentFromApi, type TashkentDate } from "@/shared/lib/format/date";

/** One doctor this client has seen, with how often. */
export interface ClientDoctorStat {
  readonly id: string;
  readonly fullName: string;
  readonly specialty: string;
  readonly visits: number;
  readonly lastVisitAt: TashkentDate | null;
}

/** A product this client buys often. */
export interface ClientTopProduct {
  readonly productId: string;
  readonly name: string;
  readonly units: number;
  readonly amount: number;
}

/**
 * The 360° numbers block of a client profile.
 *
 * Every field defaults to zero on purpose: the profile is the busiest screen at
 * the desk, and a backend that hasn't shipped one of these counters yet must
 * show "0", never a blank card.
 */
export interface ClientSummary {
  readonly visitsCount: number;
  readonly firstVisitAt: TashkentDate | null;
  readonly lastVisitAt: TashkentDate | null;
  readonly ordersCount: number;
  readonly ordersTotal: number;
  readonly paidTotal: number;
  readonly openDebt: number;
  readonly overdueDebt: number;
  readonly treatmentsCount: number;
  readonly treatmentsTotal: number;
  readonly consultationsCount: number;
  readonly consultationsTotal: number;
  readonly avgOrderAmount: number;
  /** Server-computed, so it agrees with the clinic's timezone. */
  readonly daysSinceLastVisit: number | null;
  /** How this client has paid over time, by physical type. */
  readonly paymentBreakdown: ReadonlyMap<PaymentType, number>;
  readonly doctors: readonly ClientDoctorStat[];
  readonly topProducts: readonly ClientTopProduct[];
}

export const EMPTY_CLIENT_SUMMARY: ClientSummary = {
  visitsCount: 0,
  firstVisitAt: null,
  lastVisitAt: null,
  ordersCount: 0,
  ordersTotal: 0,
  paidTotal: 0,
  openDebt: 0,
  overdueDebt: 0,
  treatmentsCount: 0,
  treatmentsTotal: 0,
  consultationsCount: 0,
  consultationsTotal: 0,
  avgOrderAmount: 0,
  daysSinceLastVisit: null,
  paymentBreakdown: new Map(),
  doctors: [],
  topProducts: [],
};

/** Everything the clinic has billed this client — goods plus services. */
export function grossTotal(summary: ClientSummary): number {
  return summary.ordersTotal + summary.treatmentsTotal + summary.consultationsTotal;
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
function optDate(v: unknown): TashkentDate | null {
  return typeof v === "string" && v !== "" ? maybeTashkentFromApi(v) : null;
}

function parseBreakdown(raw: unknown): ReadonlyMap<PaymentType, number> {
  const result = new Map<PaymentType, number>();
  if (!isRecord(raw)) return result;
  for (const [key, value] of Object.entries(raw)) {
    const amount = num(value);
    if (amount <= 0) continue;
    result.set(parsePaymentType(key), amount);
  }
  return result;
}

export function parseClientSummary(raw: unknown): ClientSummary {
  const s = isRecord(raw) ? raw : {};
  return {
    visitsCount: num(s.visits_count),
    firstVisitAt: optDate(s.first_visit_at),
    lastVisitAt: optDate(s.last_visit_at),
    ordersCount: num(s.orders_count),
    ordersTotal: num(s.orders_total),
    paidTotal: num(s.paid_total),
    openDebt: num(s.open_debt),
    overdueDebt: num(s.overdue_debt),
    treatmentsCount: num(s.treatments_count),
    treatmentsTotal: num(s.treatments_total),
    consultationsCount: num(s.consultations_count),
    consultationsTotal: num(s.consultations_total),
    avgOrderAmount: num(s.avg_order_amount),
    daysSinceLastVisit:
      typeof s.days_since_last_visit === "number" ? s.days_since_last_visit : null,
    paymentBreakdown: parseBreakdown(s.payment_breakdown),
    doctors: Array.isArray(s.doctors)
      ? s.doctors.filter(isRecord).map((d) => ({
          id: str(d.id),
          fullName: str(d.full_name),
          specialty: str(d.specialty),
          visits: num(d.visits),
          lastVisitAt: optDate(d.last_visit_at),
        }))
      : [],
    topProducts: Array.isArray(s.top_products)
      ? s.top_products.filter(isRecord).map((p) => ({
          productId: str(p.product_id),
          name: str(p.name),
          units: num(p.units),
          amount: num(p.amount),
        }))
      : [],
  };
}
