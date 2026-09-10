"use client";

import { CalendarCheck, Check, UserCheck, X } from "lucide-react";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppCard } from "@/shared/components/data-display/app-card";
import { DateRangePicker } from "@/shared/components/data-display/date-range-picker";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { DateRange } from "@/shared/domain/date-range";
import { addDays, shortDate } from "@/shared/lib/format/date";
import { percent } from "@/shared/lib/format/percent";
import { cn } from "@/shared/lib/utils";

import { useAttendanceStatisticsQuery } from "../hooks/use-attendance";

/** "Statistika" — who came how often, over a period. */
export function AttendanceStatsView() {
  const [range, setRange] = useState<DateRange | null>(null);

  const { data, error, isPending, refetch } = useAttendanceStatisticsQuery(
    range?.start ?? null,
    // The API's `date_to` is inclusive while our range end is exclusive.
    range ? addDays(range.end, -1) : null,
  );

  const chartData =
    data?.byDay.map((day) => ({
      label: shortDate(day.date),
      Keldi: day.counts.present,
      Kelmadi: day.counts.absent,
    })) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker value={range} onChange={setRange} />
        <p className="text-caption text-text-tertiary">
          Ko&rsquo;rsatilmasa — shu oy boshidan bugungacha
        </p>
      </div>

      {error && !data ? (
        <AppCard padded={false}>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </AppCard>
      ) : isPending || !data ? (
        <div className="flex flex-col gap-4" aria-hidden>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[110px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Davomat"
              value={percent.labeled(Math.round(data.summary.attendanceRate * 10) / 10)}
              icon={UserCheck}
              tone="primary"
              hint={`${data.summary.rollcallDays} kun yo'qlama qilingan`}
            />
            <StatCard
              label="Keldi"
              value={String(data.summary.present)}
              icon={Check}
              tone="primary"
            />
            <StatCard
              label="Kelmadi"
              value={String(data.summary.absent)}
              icon={X}
              tone="danger"
            />
            <StatCard
              label="Xodimlar"
              value={String(data.summary.employees)}
              icon={CalendarCheck}
              tone="neutral"
            />
          </div>

          <AppCard>
            <SectionHeader
              icon={CalendarCheck}
              title="Kunlar bo'yicha"
              subtitle="Har kuni nechta xodim kelgan"
            />
            {chartData.length === 0 ? (
              <EmptyState
                title="Ma'lumot yo'q"
                message="Bu davrda yo'qlama qilinmagan."
              />
            ) : (
              <div className="mt-4 h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--border)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11.5 }}
                      minTickGap={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      allowDecimals={false}
                      tick={{ fill: "var(--text-tertiary)", fontSize: 11.5 }}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--surface-alt)" }}
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: 12.5,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12.5 }} />
                    <Bar
                      dataKey="Keldi"
                      stackId="a"
                      fill="var(--chart-1)"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="Kelmadi"
                      stackId="a"
                      fill="var(--danger)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </AppCard>

          <AppCard padded={false} className="overflow-hidden">
            <div className="border-border border-b px-5 py-4">
              <h2 className="text-title-lg">Xodimlar kesimi</h2>
            </div>
            {data.byEmployee.length === 0 ? (
              <EmptyState
                title="Ma'lumot yo'q"
                message="Bu davrda yo'qlama qilinmagan."
              />
            ) : (
              <ul>
                {data.byEmployee.map((row, index) => (
                  <li
                    key={row.employee.id}
                    className={cn(
                      "flex items-center gap-3 px-5 py-3",
                      index > 0 && "border-surface-alt border-t",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-title-sm truncate">{row.employee.fullName}</p>
                      <p className="text-caption text-text-tertiary truncate">
                        {row.employee.position || "Lavozim ko'rsatilmagan"}
                      </p>
                    </div>
                    <span className="text-body-sm text-primary-dark tabular w-20 text-right">
                      {row.present}
                    </span>
                    <span className="text-body-sm text-danger tabular w-20 text-right">
                      {row.absent}
                    </span>
                    <span className="text-title-sm tabular w-24 text-right">
                      {percent.labeled(Math.round(row.attendanceRate * 10) / 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AppCard>
        </>
      )}
    </div>
  );
}
