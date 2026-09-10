"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { AlertsCard } from "@/features/alerts/components/alerts-card";
import { DailyClosingDialog } from "@/features/alerts/components/daily-closing-dialog";
import { AppointmentDialogsProvider } from "@/features/appointments/components/appointment-dialogs";
import { TodayAppointmentsCard } from "@/features/appointments/components/today-appointments-card";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { DateRange, StatPeriod } from "@/shared/domain/date-range";
import type { PaymentType } from "@/shared/domain/payment-type";

import type { StatsQuery } from "../api/statistics-api";
import { useDashboardQuery, useStatisticsExport } from "../hooks/use-dashboard";
import { buildChartSamples } from "../lib/chart-series";
import { DashboardHeader } from "./dashboard-header";
import { DashboardKpiStrip, DashboardPeopleStrip } from "./dashboard-kpi-strip";
import { RecentOrdersCard } from "./recent-orders-card";

import { TillBreakdownCard } from "./till-breakdown-card";
import { PaymentTypeIncomeDialog } from "./payment-type-income-dialog";
import { TopProductsCard } from "./top-products-card";

/**
 * recharts is the single heaviest dependency in the panel and the chart sits
 * below the fold, so it arrives after the figures do rather than delaying them.
 * `ssr: false` because it measures its own container — server-rendering it
 * produces markup that is thrown away on the first client paint.
 */
const RevenueChartCard = dynamic(
  () => import("./revenue-chart-card").then((m) => m.RevenueChartCard),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[340px] rounded-lg" />,
  },
);

/**
 * "Statistika" — the page reception opens to find out what to do, not to admire
 * totals. So the order is deliberate: what needs attention → what is in the
 * till → what was done → the trend → the detail.
 */
export function DashboardView() {
  const [period, setPeriod] = useState<StatPeriod>("daily");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [tillType, setTillType] = useState<PaymentType | null>(null);
  const [closingOpen, setClosingOpen] = useState(false);

  const query = useMemo<StatsQuery>(
    () => ({ period, custom: customRange }),
    [period, customRange],
  );

  const { data, error, isPending, isFetching, refetch } = useDashboardQuery(query);
  const exportMutation = useStatisticsExport();

  const samples = useMemo(
    () => (data ? buildChartSamples(data.revenueChart, period) : []),
    [data, period],
  );

  function handleCustomRange(range: DateRange) {
    setCustomRange(range);
    setPeriod("custom");
  }

  function handleOpenTill(type: PaymentType) {
    setTillType(type);
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <DashboardHeader
        period={period}
        customRange={customRange}
        onPeriodChange={setPeriod}
        onCustomRangeChange={handleCustomRange}
        onCloseDay={() => setClosingOpen(true)}
        onExport={() => exportMutation.mutate(query)}
        exporting={exportMutation.isPending}
      />

      <AlertsCard />

      {/* Deliberately outside the statistics gate: the queue is what reception
          acts on, and it must not wait for a period's figures to load. */}
      <AppointmentDialogsProvider>
        <TodayAppointmentsCard />
      </AppointmentDialogsProvider>

      {error && !data ? (
        <ErrorState error={error} onRetry={() => void refetch()} title="Xatolik" />
      ) : isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <div
          className="flex flex-col gap-4 transition-opacity duration-200"
          // While a new period is loading the previous figures stay on screen,
          // dimmed — far less jarring than collapsing the page to skeletons.
          style={{ opacity: isFetching ? 0.55 : 1 }}
          aria-busy={isFetching}
        >
          <TillBreakdownCard stats={data} onOpenTill={handleOpenTill} />
          <DashboardKpiStrip stats={data} />
          <DashboardPeopleStrip stats={data} />
          <RevenueChartCard samples={samples} period={period} />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <TopProductsCard products={data.topProducts} />
            </div>
            <div className="lg:col-span-2">
              <RecentOrdersCard orders={data.recentOrders} />
            </div>
          </div>
        </div>
      )}

      <PaymentTypeIncomeDialog
        type={tillType}
        query={query}
        open={tillType !== null}
        onOpenChange={(open) => !open && setTillType(null)}
      />

      <DailyClosingDialog open={closingOpen} onOpenChange={setClosingOpen} />
    </PageContainer>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-[196px] rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-[320px] rounded-lg lg:col-span-3" />
        <Skeleton className="h-[320px] rounded-lg lg:col-span-2" />
      </div>
    </div>
  );
}
