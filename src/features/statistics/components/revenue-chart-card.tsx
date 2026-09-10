"use client";

import { TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppCard } from "@/shared/components/data-display/app-card";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import type { StatPeriod } from "@/shared/domain/date-range";
import { money } from "@/shared/lib/format/money";

import type { ChartSample } from "../lib/chart-series";

/**
 * The sales trend.
 *
 * Hidden entirely on the `daily` tab: the backend sends hour buckets for a
 * single day, and a bar per hour of a half-finished day says less than the
 * numbers already above it. Switching to Hafta/Oy/Yil brings it back — the same
 * rule the Flutter card applied.
 */
export function RevenueChartCard({
  samples,
  period,
}: {
  samples: readonly ChartSample[];
  period: StatPeriod;
}) {
  if (period === "daily") return null;

  const subtitle =
    period === "weekly"
      ? "Shu hafta, kunlar kesimida"
      : period === "yearly"
        ? "Yillar bo'yicha dinamika"
        : "Tanlangan oraliq, faqat savdo bo'lgan kunlar";

  return (
    <AppCard>
      <SectionHeader icon={TrendingUp} title="Savdo dinamikasi" subtitle={subtitle} />
      {samples.length === 0 ? (
        <EmptyState title="Ma'lumot yo'q" message="Bu davrda savdo qayd etilmagan." />
      ) : (
        <div className="mt-4 h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={samples as ChartSample[]}
              margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              barCategoryGap="28%"
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
                interval="preserveStartEnd"
                minTickGap={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={54}
                tick={{ fill: "var(--text-tertiary)", fontSize: 11.5 }}
                tickFormatter={(value: number) => money.compact(value)}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-alt)" }}
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
              <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AppCard>
  );
}
