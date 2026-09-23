import type { OrderSummary } from "@/features/orders/types/order";
import type { PayoutDay } from "@/features/payouts/types/payout";
import type { CommissionBreakdown } from "@/shared/domain/commission-breakdown";
import type { PaymentType } from "@/shared/domain/payment-type";

/** Headline KPI figures (dashboard totals, or one doctor's totals). */
export interface KpiStats {
  readonly totalOrders: number;
  readonly totalUnits: number;
  readonly totalRevenue: number;
  readonly totalCommission: number;
}

export const ZERO_KPIS: KpiStats = {
  totalOrders: 0,
  totalUnits: 0,
  totalRevenue: 0,
  totalCommission: 0,
};

/**
 * One raw chart bucket. The `date` format depends on the period: `daily` → hour
 * (`YYYY-MM-DDTHH:00`), `weekly`/`monthly` → day (`YYYY-MM-DD`), `yearly` →
 * month (`YYYY-MM`).
 */
export interface ChartPoint {
  readonly date: string;
  readonly value: number;
}

/** How a product is boxed, when the payload says so. */
export interface Packaging {
  /** Units per package. Null or 1 means the product isn't boxed at all. */
  readonly size: number | null;
  /** What one package is called ("karobka"). */
  readonly label: string;
}

export const NO_PACKAGING: Packaging = { size: null, label: "karobka" };

/** Product sales aggregate (statistics/products, dashboard top_products). */
export interface ProductStat {
  readonly productId: string;
  readonly name: string;
  /** Always base units (dona) — that is how the whole system counts. */
  readonly unitsSold: number;
  readonly revenue: number;
  readonly imageUrl: string | null;
  readonly currentPrice: number | null;
  readonly packaging: Packaging;
}

/**
 * Orders the doctor earned on that were NOT rung up at the desk: the client
 * ordered in the app on their recommendation, or the doctor placed the order
 * from their own app.
 *
 * The two figures behave differently on purpose, and mixing them up is how a
 * day's takings get overstated:
 * - `commission` **is already inside** `commissionEarned` — the clinic owes it.
 * - `revenue` is **not** inside `revenue` — that money never passed the till.
 *
 * The backend only counts these from a cutoff date onwards, so an older period
 * reports zeros here. That is the intended answer, not a gap.
 */
export interface AppOrderStats {
  readonly ordersCount: number;
  readonly unitsSold: number;
  readonly revenue: number;
  readonly commission: number;
}

export const ZERO_APP_ORDERS: AppOrderStats = {
  ordersCount: 0,
  unitsSold: 0,
  revenue: 0,
  commission: 0,
};

/** Whether this period has anything to say about app orders at all. */
export function hasAppOrders(stats: AppOrderStats): boolean {
  return stats.ordersCount > 0 || stats.commission !== 0;
}

/** Per-doctor sales aggregate (statistics/doctors list). */
export interface DoctorStat {
  readonly doctorId: string;
  readonly fullName: string;
  readonly specialty: string;
  readonly commissionPercent: number;
  readonly ordersCount: number;
  readonly unitsSold: number;
  /** Desk sales only; app orders are reported apart, in {@link appOrders}. */
  readonly revenue: number;
  /** Product commission only — services are counted separately. */
  readonly commissionEarned: number;
  readonly appOrders: AppOrderStats;
  /** Products **and** services: what the doctor actually earned this period. */
  readonly totalCommission: number;
  /**
   * `adjustments` is always 0 here: statistics report the shop's sales, and
   * corrections have never been counted in them. The payouts screens are where
   * a correction shows up.
   */
  readonly commissionBreakdown: CommissionBreakdown | null;
  readonly avatarUrl: string | null;
}

/**
 * Real cash-in per physical payment type (`payment_breakdown`). A split order
 * contributes its own slice to each type, so this answers "how much cash / card
 * / terminal hit the till".
 */
export interface PaymentBreakdown {
  readonly cash: number;
  readonly card: number;
  readonly terminal: number;
}

export const ZERO_PAYMENT_BREAKDOWN: PaymentBreakdown = {
  cash: 0,
  card: 0,
  terminal: 0,
};

export function breakdownTotal(b: PaymentBreakdown): number {
  return b.cash + b.card + b.terminal;
}

export function breakdownOf(b: PaymentBreakdown, type: PaymentType): number {
  return b[type];
}

/**
 * Expenses split by the till they left (`expense_breakdown`).
 *
 * `unspecified` is what older records add up to: counted in the day's total but
 * taken off no single till — which is why `Σ payment_breakdown` can exceed
 * `net_revenue` by exactly this much.
 */
export interface ExpenseBreakdown extends PaymentBreakdown {
  readonly unspecified: number;
}

export const ZERO_EXPENSE_BREAKDOWN: ExpenseBreakdown = {
  cash: 0,
  card: 0,
  terminal: 0,
  unspecified: 0,
};

export function expenseTotal(b: ExpenseBreakdown): number {
  return b.cash + b.card + b.terminal + b.unspecified;
}

/**
 * Service revenue for the period. Kept apart from product revenue because the
 * clinic bills the two very differently: goods have stock and a supplier cost,
 * services have a doctor and a commission.
 */
export interface ServiceStats {
  readonly servicesRevenue: number;
  readonly treatmentsCount: number;
  readonly treatmentsRevenue: number;
  readonly consultationsCount: number;
  readonly consultationsRevenue: number;
}

export const ZERO_SERVICES: ServiceStats = {
  servicesRevenue: 0,
  treatmentsCount: 0,
  treatmentsRevenue: 0,
  consultationsCount: 0,
  consultationsRevenue: 0,
};

/** Credit extended and collected in the period, plus the standing balance. */
export interface DebtStats {
  /** New credit extended during the period. */
  readonly debtIssued: number;
  /** Repayments received during the period. */
  readonly debtCollected: number;
  /** Total still owed **at this moment** — not a period figure. */
  readonly debtOutstanding: number;
  readonly debtOverdue: number;
}

export const ZERO_DEBTS: DebtStats = {
  debtIssued: 0,
  debtCollected: 0,
  debtOutstanding: 0,
  debtOverdue: 0,
};

export interface OrdersByType {
  readonly clinic: number;
  readonly delivery: number;
}
export const ZERO_ORDERS_BY_TYPE: OrdersByType = { clinic: 0, delivery: 0 };

export interface ClientsStats {
  readonly newClients: number;
  readonly returning: number;
  readonly totalActive: number;
}
export const ZERO_CLIENTS: ClientsStats = {
  newClients: 0,
  returning: 0,
  totalActive: 0,
};

export interface VisitsStats {
  readonly scheduled: number;
  readonly arrived: number;
  readonly noShow: number;
  readonly cancelled: number;
}
export const ZERO_VISITS: VisitsStats = {
  scheduled: 0,
  arrived: 0,
  noShow: 0,
  cancelled: 0,
};

/** Stock health, so a shelf never runs out unnoticed. */
export interface DashboardStockStats {
  readonly lowStockCount: number;
  readonly outOfStockCount: number;
  readonly stockValue: number;
}
export const ZERO_STOCK: DashboardStockStats = {
  lowStockCount: 0,
  outOfStockCount: 0,
  stockValue: 0,
};

/** The whole `statistics/dashboard/` payload. */
export interface DashboardStats {
  readonly kpis: KpiStats;
  readonly revenueChart: readonly ChartPoint[];
  readonly topProducts: readonly ProductStat[];
  readonly recentOrders: readonly OrderSummary[];
  /** Sum of `expense_date`-matched expenses for the period. */
  readonly totalExpenses: number;
  /** `total_revenue − total_expenses`. */
  readonly netRevenue: number;
  /**
   * Cash-in split by payment type. Covers **three** sources — product sales,
   * services and debt repayments — so it is money that reached the till, not
   * product revenue.
   */
  readonly paymentBreakdown: PaymentBreakdown;
  /** The same tills **before** expenses. */
  readonly paymentBreakdownGross: PaymentBreakdown;
  readonly expenseBreakdown: ExpenseBreakdown;
  readonly services: ServiceStats;
  /** `total_revenue + services_revenue` — everything billed. */
  readonly grossRevenue: number;
  /** What actually reached the till, credit excluded. */
  readonly totalCollected: number;
  readonly debts: DebtStats;
  readonly ordersByType: OrdersByType;
  readonly clients: ClientsStats;
  readonly visits: VisitsStats;
  readonly stock: DashboardStockStats;
}

/**
 * True once the server is netting expenses out of the tills — the moment "Naqd"
 * stops meaning "cash taken" and starts meaning "cash left".
 */
export function nettedTills(stats: DashboardStats): boolean {
  return expenseTotal(stats.expenseBreakdown) > 0;
}

/** `statistics/doctors/{id}/` payload. */
export interface DoctorDetailStats {
  readonly doctorId: string;
  readonly fullName: string;
  readonly specialty: string;
  readonly commissionPercent: number;
  readonly avatarUrl: string | null;
  readonly kpis: KpiStats;
  readonly commissionBreakdown: CommissionBreakdown | null;
  readonly appOrders: AppOrderStats;
  /** Desk sales only, by revenue — app orders are not part of this. */
  readonly productsBreakdown: readonly ProductStat[];
  readonly commissionChart: readonly ChartPoint[];
  /**
   * The period opened day → order → product, in the same shape the payouts
   * screens use. The backend guarantees the days add up to `totalCommission`,
   * so this is the receipt behind the headline figure.
   */
  readonly days: readonly PayoutDay[];
}
