"use client";

import { ChevronRight, Wallet } from "lucide-react";

import { AppCard } from "@/shared/components/data-display/app-card";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_ICON,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { DashboardStats } from "../types/statistics";
import { breakdownOf } from "../types/statistics";

/**
 * "Kassada qancha qoldi" — each till after its own expenses.
 *
 * `payment_breakdown` is **net** since the expense payment type shipped: cash
 * spending comes off the cash till, card off card. So a tile shows what is
 * left, with the takings and the spending underneath — the three numbers that
 * answer "why is there less cash than I sold?" without opening a report.
 *
 * A till can go negative (more paid out than taken in that day). That is a real
 * state and is shown in red rather than clamped to zero.
 */
export function TillBreakdownCard({
  stats,
  onOpenTill,
}: {
  stats: DashboardStats;
  /** Opens every sale and service whose money landed in that till. */
  onOpenTill?: (type: PaymentType) => void;
}) {
  return (
    <AppCard>
      <SectionHeader
        icon={Wallet}
        title="Kassada qancha qoldi"
        subtitle="Har bir kassa — xarajatlar ayirilgandan keyin"
      />
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {PAYMENT_TYPES.map((type) => (
          <TillTile
            key={type}
            type={type}
            net={breakdownOf(stats.paymentBreakdown, type)}
            gross={breakdownOf(stats.paymentBreakdownGross, type)}
            spent={breakdownOf(stats.expenseBreakdown, type)}
            onClick={onOpenTill ? () => onOpenTill(type) : undefined}
          />
        ))}
      </div>
      {stats.expenseBreakdown.unspecified > 0 && (
        <p className="text-caption text-text-tertiary mt-3">
          Belgilanmagan xarajat: {money.uzs(stats.expenseBreakdown.unspecified)} — bu
          summa hech qaysi kassadan ayirilmagan.
        </p>
      )}
    </AppCard>
  );
}

const TONE: Readonly<Record<PaymentType, { chip: string; icon: string }>> = {
  cash: { chip: "bg-primary/12", icon: "text-primary" },
  card: { chip: "bg-info/12", icon: "text-info" },
  terminal: { chip: "bg-gold/14", icon: "text-gold" },
};

function TillTile({
  type,
  net,
  gross,
  spent,
  onClick,
}: {
  type: PaymentType;
  net: number;
  gross: number;
  spent: number;
  onClick?: () => void;
}) {
  const Icon = PAYMENT_TYPE_ICON[type];
  const tone = TONE[type];

  const content = (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-[34px] items-center justify-center rounded-sm",
            tone.chip,
          )}
          aria-hidden
        >
          <Icon className={cn("size-[18px]", tone.icon)} />
        </span>
        <span className="text-label-sm text-text-secondary flex-1">
          {PAYMENT_TYPE_LABEL[type]}
        </span>
        {onClick && <ChevronRight className="text-text-tertiary size-4" aria-hidden />}
      </div>
      <p className={cn("text-headline tabular mt-3", net < 0 && "text-danger")}>
        {money.plain(net)}
      </p>
      <div className="border-surface-alt mt-2.5 flex gap-4 border-t pt-2.5">
        <div>
          <p className="text-caption text-text-tertiary">Tushum</p>
          <p className="text-title-sm tabular mt-0.5">{money.plain(gross)}</p>
        </div>
        <div>
          <p className="text-caption text-text-tertiary">Xarajat</p>
          <p
            className={cn(
              "text-title-sm tabular mt-0.5",
              spent > 0 ? "text-danger" : "text-text-tertiary",
            )}
          >
            {spent > 0 ? `−${money.plain(spent)}` : "0"}
          </p>
        </div>
      </div>
    </>
  );

  const base = "rounded-md border border-border bg-surface p-4 text-left";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${PAYMENT_TYPE_LABEL[type]} kassasi tafsilotlari`}
      className={cn(
        base,
        "hover:border-primary/35 hover:bg-surface-hover transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {content}
    </button>
  ) : (
    <div className={base}>{content}</div>
  );
}
