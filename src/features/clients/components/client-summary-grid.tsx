import { PAYMENT_TYPE_LABEL } from "@/shared/domain/payment-type";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { ClientSummary } from "../types/client-summary";

/**
 * The 360° numbers: visits, orders, money, debt, services — plus how the client
 * has paid over time and which doctors they have seen.
 *
 * One glance is meant to answer "who is this and how do we treat them", which
 * is why the debt figure is coloured and nothing else is.
 */
export function ClientSummaryGrid({ summary }: { summary: ClientSummary }) {
  const stats: readonly {
    label: string;
    value: string;
    tone?: string;
    emphasised?: boolean;
  }[] = [
    { label: "Tashrif", value: String(summary.visitsCount) },
    { label: "Buyurtma", value: String(summary.ordersCount) },
    { label: "Xarid", value: money.compact(summary.ordersTotal) },
    { label: "To'langan", value: money.compact(summary.paidTotal) },
    ...(summary.openDebt > 0
      ? [
          {
            label: "Qarz",
            value: money.compact(summary.openDebt),
            tone: summary.overdueDebt > 0 ? "text-danger" : "text-warning",
            emphasised: true,
          },
        ]
      : []),
    { label: "Muolaja", value: String(summary.treatmentsCount) },
    ...(summary.consultationsCount > 0
      ? [{ label: "Konsultatsiya", value: String(summary.consultationsCount) }]
      : []),
    { label: "O'rtacha", value: money.compact(summary.avgOrderAmount) },
    ...(summary.daysSinceLastVisit !== null
      ? [
          {
            label: "Oxirgi tashrif",
            value:
              summary.daysSinceLastVisit === 0
                ? "Bugun"
                : `${summary.daysSinceLastVisit} kun`,
          },
        ]
      : []),
  ];

  const payments = [...summary.paymentBreakdown].map(
    ([type, amount]) => `${PAYMENT_TYPE_LABEL[type]} ${money.plain(amount)}`,
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn(
              "rounded-sm px-3 py-2",
              stat.emphasised
                ? "border border-current/30 bg-current/10"
                : "bg-surface-alt",
              stat.tone,
            )}
          >
            <p className={cn("text-title-sm tabular", stat.tone)}>{stat.value}</p>
            <p className="text-label-xs text-text-tertiary">{stat.label}</p>
          </div>
        ))}
      </div>

      {payments.length > 0 && <InlineList label="To'lovlar" entries={payments} />}

      {summary.doctors.length > 0 && (
        <InlineList
          label="Shifokorlar"
          entries={summary.doctors.map((d) => `${d.fullName} (${d.visits})`)}
        />
      )}

      {summary.topProducts.length > 0 && (
        <InlineList
          label="Ko'p oladi"
          entries={summary.topProducts.slice(0, 3).map((p) => `${p.name} × ${p.units}`)}
        />
      )}

      {summary.visitsCount === 0 && summary.ordersCount === 0 && (
        <p className="text-caption text-text-tertiary">
          Hali tashrif yoki buyurtma yo&rsquo;q
        </p>
      )}
    </div>
  );
}

/** "Label: a · b · c" — a breakdown that doesn't need a card of its own. */
function InlineList({ label, entries }: { label: string; entries: string[] }) {
  return (
    <p className="text-caption text-text-secondary">
      <span className="text-text-tertiary">{label}: </span>
      {entries.join(" · ")}
    </p>
  );
}
