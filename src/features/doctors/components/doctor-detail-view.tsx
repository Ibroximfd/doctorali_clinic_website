"use client";

import {
  ArrowLeft,
  BriefcaseMedical,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppRoutes } from "@/config/routes";
import type { StatsQuery } from "@/features/statistics/api/statistics-api";
import { useDoctorDetailQuery } from "@/features/statistics/hooks/use-dashboard";
import {
  buildChartSamples,
  type ChartSample,
} from "@/features/statistics/lib/chart-series";
import { AppCard } from "@/shared/components/data-display/app-card";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PeriodSelector } from "@/shared/components/data-display/period-selector";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { StatPeriod } from "@/shared/domain/date-range";
import { formatUnits } from "@/shared/domain/packaging";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";

/** One doctor's period: the KPIs, the commission trend and what they sold. */
export function DoctorDetailView({ doctorId }: { doctorId: string }) {
  const [period, setPeriod] = useState<StatPeriod>("monthly");
  const query = useMemo<StatsQuery>(() => ({ period }), [period]);

  const { data, error, isPending, isFetching, refetch } = useDoctorDetailQuery(
    doctorId,
    query,
  );

  const samples = useMemo(
    () => (data ? buildChartSamples(data.commissionChart, period) : []),
    [data, period],
  );

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={AppRoutes.doctors}
          aria-label="Shifokorlar ro'yxatiga qaytish"
          className="border-border bg-surface text-text-secondary hover:bg-surface-hover focus-visible:ring-ring flex size-9 items-center justify-center rounded-sm border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ArrowLeft className="size-[17px]" />
        </Link>
        <div className="flex-1" />
        <PeriodSelector value={period} onChange={setPeriod} granularity />
      </div>

      {error && !data ? (
        <AppCard padded={false}>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </AppCard>
      ) : isPending || !data ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <Skeleton className="h-[112px] rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : (
        <div
          className="flex flex-col gap-4"
          style={{ opacity: isFetching ? 0.6 : 1 }}
          aria-busy={isFetching}
        >
          <AppCard>
            <div className="flex items-center gap-4">
              <AppAvatar name={data.fullName} imageUrl={data.avatarUrl} size={64} />
              <div className="min-w-0 flex-1">
                <h2 className="text-headline truncate">{data.fullName}</h2>
                <p className="text-body-sm text-text-secondary mt-1">
                  {data.specialty || "Mutaxassislik ko'rsatilmagan"}
                </p>
              </div>
              <div className="bg-primary-soft text-label text-primary-dark shrink-0 rounded-full px-3 py-1.5">
                {percent.labeled(data.commissionPercent)}
              </div>
            </div>
          </AppCard>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Buyurtmalar"
              value={String(data.kpis.totalOrders)}
              icon={ShoppingCart}
              tone="info"
            />
            <StatCard
              label="Sotilgan dona"
              value={String(data.kpis.totalUnits)}
              icon={Package}
              tone="neutral"
            />
            <StatCard
              label="Savdo"
              value={money.plain(data.kpis.totalRevenue)}
              icon={DollarSign}
              tone="primary"
            />
            <StatCard
              label="Komissiya"
              value={money.plain(data.kpis.totalCommission)}
              icon={TrendingUp}
              tone="gold"
            />
          </div>

          <AppCard>
            <SectionHeader
              icon={TrendingUp}
              title="Komissiya dinamikasi"
              subtitle="Tanlangan davr kesimida"
            />
            {samples.length === 0 ? (
              <EmptyState
                title="Ma'lumot yo'q"
                message="Bu davrda komissiya hisoblanmagan."
              />
            ) : (
              <div className="mt-4 h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={samples}
                    margin={{ top: 4, right: 8, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="axisLabel"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11.5 }}
                      minTickGap={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={54}
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11.5 }}
                      tickFormatter={(v: number) => money.compact(v)}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border-strong)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const sample = payload[0].payload as ChartSample;
                        return (
                          <div className="border-border bg-popover rounded-sm border px-3 py-2 shadow-md">
                            <p className="text-caption text-text-secondary">
                              {sample.tooltipLabel}
                            </p>
                            <p className="text-title-sm tabular mt-0.5">
                              {money.uzs(sample.value)}
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--chart-1)"
                      strokeWidth={2.4}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </AppCard>

          <AppCard>
            <SectionHeader
              icon={BriefcaseMedical}
              title="Mahsulotlar kesimi"
              subtitle="Shu shifokor orqali sotilgan mahsulotlar"
            />
            {data.productsBreakdown.length === 0 ? (
              <EmptyState
                title="Ma'lumot yo'q"
                message="Bu davrda mahsulot sotilmagan."
              />
            ) : (
              <ul className="mt-4 flex flex-col">
                {data.productsBreakdown.map((product, index) => (
                  <li
                    key={product.productId}
                    className={`flex items-center gap-3 py-2.5 ${index > 0 ? "border-surface-alt border-t" : ""}`}
                  >
                    <span className="text-title-sm min-w-0 flex-1 truncate">
                      {product.name}
                    </span>
                    <span className="text-caption text-text-tertiary shrink-0">
                      {formatUnits(product.packaging, product.unitsSold)}
                    </span>
                    <span className="text-title-sm tabular w-32 shrink-0 text-right">
                      {money.plain(product.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </div>
      )}
    </PageContainer>
  );
}
