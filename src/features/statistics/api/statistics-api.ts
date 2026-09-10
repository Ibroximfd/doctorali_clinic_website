import { parseOrderSummary } from "@/features/orders/types/order";
import { parsePackaging } from "@/shared/domain/packaging";
import {
  resolveRange,
  toApiRange,
  type DateRange,
  type StatPeriod,
} from "@/shared/domain/date-range";
import type { PaymentType } from "@/shared/domain/payment-type";
import { endpoints } from "@/shared/lib/api/endpoints";
import {
  parsePaymentTypeIncome,
  type PaymentTypeIncome,
} from "../types/payment-type-income";
import { http, type Query } from "@/shared/lib/api/http";
import { parsePaginated, type Paginated } from "@/shared/lib/api/pagination";

import type {
  ChartPoint,
  DashboardStats,
  DoctorDetailStats,
  DoctorStat,
  ExpenseBreakdown,
  PaymentBreakdown,
  ProductStat,
} from "../types/statistics";
import { ZERO_EXPENSE_BREAKDOWN, ZERO_PAYMENT_BREAKDOWN } from "../types/statistics";

/**
 * The period selection, rendered to query params.
 *
 * The period is sent as-is so the KPIs always match the selected tab. Chart
 * bucketing per period is the backend's: daily → hours, weekly → days,
 * monthly → months, yearly → years, custom → days of the range.
 */
export interface StatsQuery {
  readonly period: StatPeriod;
  readonly custom?: DateRange | null;
  /** Restrict every KPI/chart/breakdown to one till; null = all types. */
  readonly paymentType?: PaymentType | null;
}

export function statsQueryParams(query: StatsQuery): Query {
  const range =
    query.period === "custom" && query.custom
      ? toApiRange(query.custom)
      : { period: apiPeriodName(query.period) };

  return {
    ...range,
    ...(query.paymentType ? { payment_type: query.paymentType } : {}),
  };
}

/** `custom` has its own `date_from`/`date_to`; the server never sees the word. */
function apiPeriodName(period: StatPeriod): string {
  return period === "custom" ? "monthly" : period;
}

/** A stable, serialisable key for React Query. */
export function statsQueryKey(query: StatsQuery): readonly unknown[] {
  const range = resolveRange(query.period, { custom: query.custom ?? null });
  return [
    query.period,
    query.period === "custom" ? range.start.getTime() : null,
    query.period === "custom" ? range.end.getTime() : null,
    query.paymentType ?? null,
  ];
}

// --- Parsers -----------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function optNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function str(v: unknown, fallback = ""): string {
  return v === null || v === undefined ? fallback : String(v);
}

function parseChartPoints(raw: unknown, valueKey: string): ChartPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((p) => ({
    date: str(p.date),
    value: num(p[valueKey]),
  }));
}

/**
 * Reads the product image from any of the shapes the stats endpoints use: a
 * top-level `image_url`/`image`/`photo`, or a nested `product` object. Null
 * when none is present — the dashboard `top_products` currently omits it.
 */
function imageOf(row: Record<string, unknown>): string | null {
  for (const key of ["image_url", "image", "photo", "picture"] as const) {
    const v = row[key];
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  if (isRecord(row.product)) {
    const v = row.product.image_url ?? row.product.image;
    if (typeof v === "string" && v.trim() !== "") return v;
  }
  return null;
}

export function parseProductStat(raw: unknown): ProductStat {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    productId: str(p.product_id),
    name: str(p.name),
    unitsSold: num(p.units_sold),
    revenue: num(p.revenue),
    imageUrl: imageOf(p),
    currentPrice: optNum(p.current_price),
    // The fields may sit on the row itself or inside a nested `product`.
    packaging: parsePackaging(p.package_size !== undefined ? p : p.product),
  };
}

export function parseDoctorStat(raw: unknown): DoctorStat {
  const d = (raw ?? {}) as Record<string, unknown>;
  return {
    doctorId: str(d.doctor_id),
    fullName: str(d.full_name),
    specialty: str(d.specialty),
    commissionPercent: num(d.commission_percent),
    ordersCount: num(d.orders_count),
    unitsSold: num(d.units_sold),
    revenue: num(d.revenue),
    commissionEarned: num(d.commission_earned),
    avatarUrl: typeof d.avatar_url === "string" ? d.avatar_url : null,
  };
}

function parsePaymentBreakdown(raw: unknown): PaymentBreakdown {
  if (!isRecord(raw)) return ZERO_PAYMENT_BREAKDOWN;
  return {
    cash: num(raw.cash),
    card: num(raw.card),
    terminal: num(raw.terminal),
  };
}

function parseExpenseBreakdown(raw: unknown): ExpenseBreakdown {
  if (!isRecord(raw)) return ZERO_EXPENSE_BREAKDOWN;
  return {
    cash: num(raw.cash),
    card: num(raw.card),
    terminal: num(raw.terminal),
    unspecified: num(raw.unspecified),
  };
}

export function parseDashboardStats(raw: unknown): DashboardStats {
  const j = (raw ?? {}) as Record<string, unknown>;
  const totalRevenue = num(j.total_revenue);
  const totalExpenses = num(j.total_expenses);
  const servicesRevenue = num(j.services_revenue);

  const gross = isRecord(j.payment_breakdown_gross)
    ? parsePaymentBreakdown(j.payment_breakdown_gross)
    : parsePaymentBreakdown(j.payment_breakdown);

  return {
    kpis: {
      totalOrders: num(j.total_orders),
      totalUnits: num(j.total_units_sold),
      totalRevenue,
      totalCommission: num(j.total_commission),
    },
    revenueChart: parseChartPoints(j.revenue_chart, "revenue"),
    topProducts: Array.isArray(j.top_products)
      ? j.top_products.map(parseProductStat)
      : [],
    recentOrders: Array.isArray(j.recent_orders)
      ? j.recent_orders.map(parseOrderSummary)
      : [],
    totalExpenses,
    // Server-computed, but recomputed locally as a fallback so older backends
    // without the field still show a net figure.
    netRevenue:
      typeof j.net_revenue === "number" ? j.net_revenue : totalRevenue - totalExpenses,
    paymentBreakdown: parsePaymentBreakdown(j.payment_breakdown),
    paymentBreakdownGross: gross,
    expenseBreakdown: parseExpenseBreakdown(j.expense_breakdown),
    // Every new section defaults to zero, so a backend that hasn't shipped them
    // renders an honest "0" instead of breaking the dashboard.
    services: {
      servicesRevenue,
      treatmentsCount: num(j.treatments_count),
      treatmentsRevenue: num(j.treatments_revenue),
      consultationsCount: num(j.consultations_count),
      consultationsRevenue: num(j.consultations_revenue),
    },
    grossRevenue:
      typeof j.gross_revenue === "number"
        ? j.gross_revenue
        : totalRevenue + servicesRevenue,
    totalCollected: num(j.total_collected),
    debts: {
      debtIssued: num(j.debt_issued),
      debtCollected: num(j.debt_collected),
      debtOutstanding: num(j.debt_outstanding),
      debtOverdue: num(j.debt_overdue),
    },
    ordersByType: isRecord(j.orders_by_type)
      ? {
          clinic: num(j.orders_by_type.clinic),
          delivery: num(j.orders_by_type.delivery),
        }
      : { clinic: 0, delivery: 0 },
    clients: isRecord(j.clients)
      ? {
          newClients: num(j.clients.new),
          returning: num(j.clients.returning),
          totalActive: num(j.clients.total_active),
        }
      : { newClients: 0, returning: 0, totalActive: 0 },
    visits: isRecord(j.visits)
      ? {
          scheduled: num(j.visits.scheduled),
          arrived: num(j.visits.arrived),
          noShow: num(j.visits.no_show),
          cancelled: num(j.visits.cancelled),
        }
      : { scheduled: 0, arrived: 0, noShow: 0, cancelled: 0 },
    stock: isRecord(j.stock)
      ? {
          lowStockCount: num(j.stock.low_stock_count),
          outOfStockCount: num(j.stock.out_of_stock_count),
          stockValue: num(j.stock.stock_value),
        }
      : { lowStockCount: 0, outOfStockCount: 0, stockValue: 0 },
  };
}

// --- Calls -------------------------------------------------------------------

export async function fetchDashboard(
  query: StatsQuery,
  signal?: AbortSignal,
): Promise<DashboardStats> {
  const raw = await http.get<unknown>(endpoints.statsDashboard, {
    query: statsQueryParams(query),
    signal,
  });
  const stats = parseDashboardStats(raw);
  return withTopProductImages(stats, query, signal);
}

/**
 * The dashboard's `top_products[]` omits `image_url`, so the thumbnails render
 * empty. `statistics/products/` returns the same products WITH their image, so
 * the gap is filled by joining on `product_id`.
 *
 * Best-effort: any failure (or a backend that already sends the image) leaves
 * the dashboard untouched — images must never break the whole screen. Once the
 * backend includes `image_url` in `top_products`, the extra request is skipped.
 */
async function withTopProductImages(
  stats: DashboardStats,
  query: StatsQuery,
  signal?: AbortSignal,
): Promise<DashboardStats> {
  if (!stats.topProducts.some((p) => p.imageUrl === null)) return stats;
  try {
    const page = await fetchProductStats({
      query,
      ordering: "-revenue",
      signal,
    });
    const byId = new Map<string, string>();
    for (const p of page.results) {
      if (p.imageUrl) byId.set(p.productId, p.imageUrl);
    }
    if (byId.size === 0) return stats;
    return {
      ...stats,
      topProducts: stats.topProducts.map((p) =>
        p.imageUrl === null ? { ...p, imageUrl: byId.get(p.productId) ?? null } : p,
      ),
    };
  } catch {
    return stats;
  }
}

export function fetchProductStats(input: {
  query: StatsQuery;
  ordering?: string;
  search?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<ProductStat>> {
  return http
    .get<unknown>(endpoints.statsProducts, {
      query: {
        ...statsQueryParams(input.query),
        ordering: input.ordering ?? "-revenue",
        page: input.page ?? 1,
        search: input.search,
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseProductStat));
}

export function fetchDoctorStats(input: {
  query: StatsQuery;
  ordering?: string;
  search?: string;
  page?: number;
  signal?: AbortSignal;
}): Promise<Paginated<DoctorStat>> {
  return http
    .get<unknown>(endpoints.statsDoctors, {
      query: {
        ...statsQueryParams(input.query),
        ordering: input.ordering ?? "-revenue",
        page: input.page ?? 1,
        search: input.search,
      },
      signal: input.signal,
    })
    .then((raw) => parsePaginated(raw as never, parseDoctorStat));
}

export async function fetchDoctorDetail(input: {
  doctorId: string;
  query: StatsQuery;
  signal?: AbortSignal;
}): Promise<DoctorDetailStats> {
  const raw = (await http.get<unknown>(endpoints.statsDoctor(input.doctorId), {
    query: statsQueryParams(input.query),
    signal: input.signal,
  })) as Record<string, unknown>;
  const doctor = isRecord(raw.doctor) ? raw.doctor : {};
  return {
    doctorId: str(doctor.id),
    fullName: str(doctor.full_name),
    specialty: str(doctor.specialty),
    commissionPercent: num(doctor.commission_percent),
    avatarUrl: typeof doctor.avatar_url === "string" ? doctor.avatar_url : null,
    kpis: {
      totalOrders: num(raw.orders_count),
      totalUnits: num(raw.units_sold),
      totalRevenue: num(raw.revenue),
      totalCommission: num(raw.commission_earned),
    },
    productsBreakdown: Array.isArray(raw.products_breakdown)
      ? raw.products_breakdown.map(parseProductStat)
      : [],
    commissionChart: parseChartPoints(raw.commission_chart, "commission"),
  };
}

/**
 * Downloads the `.xlsx` export for exactly the filters on screen, so the
 * workbook matches the dashboard.
 */
export function exportStatistics(query: StatsQuery) {
  return http.blob(endpoints.statsExport, {
    query: statsQueryParams(query),
    fallbackFileName: "reception-statistika.xlsx",
  });
}

/**
 * `GET statistics/payment-type/` — everything one till took in over a period.
 *
 * One call does it: the endpoint returns the totals AND the records behind
 * them, so the drill-down never adds anything up itself.
 */
export function fetchPaymentTypeIncome(input: {
  type: PaymentType;
  query: StatsQuery;
  signal?: AbortSignal;
}): Promise<PaymentTypeIncome> {
  return http
    .get<unknown>(endpoints.statsPaymentType, {
      query: { ...statsQueryParams(input.query), type: input.type },
      signal: input.signal,
    })
    .then(parsePaymentTypeIncome);
}
