"use client";

import { Inbox, ShoppingCart, Stethoscope, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PAYMENT_TYPE_LABEL, type PaymentType } from "@/shared/domain/payment-type";
import { shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { StatsQuery } from "../api/statistics-api";
import { usePaymentTypeIncomeQuery } from "../hooks/use-dashboard";
import { entryKindLabel, type PaymentTypeEntry } from "../types/payment-type-income";

const KIND_ICON: Readonly<Record<string, LucideIcon>> = {
  order: ShoppingCart,
  treatment: Stethoscope,
  debt_repayment: Wallet,
};

/**
 * What is behind one till tile: every sale, service and repayment whose money
 * reached THIS payment type in the period on screen.
 *
 * The money is the server's — `total`, `gross`, `expenses` and the per-source
 * figures stay complete even when the row list is capped, so nothing here is
 * added up locally.
 */
export function PaymentTypeIncomeDialog({
  type,
  query,
  open,
  onOpenChange,
}: {
  type: PaymentType | null;
  query: StatsQuery;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const income = usePaymentTypeIncomeQuery(open ? type : null, query);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{type ? PAYMENT_TYPE_LABEL[type] : "Kassa"}</DialogTitle>
          <DialogDescription>
            Shu kassaga tushgan barcha sotuv, muolaja va qarz to&rsquo;lovlari.
          </DialogDescription>
        </DialogHeader>

        {income.error && !income.data ? (
          <ErrorState error={income.error} onRetry={() => void income.refetch()} />
        ) : income.isPending || !income.data ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-[76px] rounded-md" />
            <Skeleton className="h-[220px] rounded-md" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              <Figure label="Kirim" value={money.compact(income.data.gross)} />
              <Figure
                label="Chiqim"
                value={money.compact(income.data.expenses)}
                tone={income.data.expenses > 0 ? "text-danger" : undefined}
              />
              <Figure
                label="Qoldiq"
                value={money.compact(income.data.total)}
                tone="text-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Source
                label="Buyurtma"
                count={income.data.orders.count}
                amount={income.data.orders.amount}
              />
              <Source
                label="Muolaja"
                count={income.data.treatments.count}
                amount={income.data.treatments.amount}
              />
              <Source
                label="Qarz to'lovi"
                count={income.data.debtRepayments.count}
                amount={income.data.debtRepayments.amount}
              />
            </div>

            {income.data.items.length === 0 ? (
              <EmptyState icon={Inbox} title="Yozuv yo'q" />
            ) : (
              <>
                <ul className="divide-border/60 border-border divide-y rounded-md border">
                  {income.data.items.map((entry) => (
                    <li key={`${entry.kind}:${entry.id}`}>
                      <EntryRow entry={entry} />
                    </li>
                  ))}
                </ul>
                {/* The list is capped by the server; the totals above are not. */}
                {income.data.itemsTruncated && (
                  <p className="text-caption text-text-tertiary">
                    Ro&rsquo;yxat qisqartirilgan — yuqoridagi summalar to&rsquo;liq.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryRow({ entry }: { entry: PaymentTypeEntry }) {
  const Icon = KIND_ICON[entry.kind] ?? Wallet;
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="bg-surface-alt flex size-8 shrink-0 items-center justify-center rounded-full">
        <Icon className="text-text-secondary size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-title-sm block truncate">{entry.title}</span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {entry.subtitle} · {entryKindLabel(entry.kind)} · {shortDateTime(entry.at)}
        </span>
      </span>
      <span className="text-title-sm tabular shrink-0">{money.plain(entry.amount)}</span>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-border bg-surface-alt rounded-md border p-3">
      <p className={cn("text-title-lg tabular", tone)}>{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}

function Source({
  label,
  count,
  amount,
}: {
  label: string;
  count: number;
  amount: number;
}) {
  return (
    <div className="border-border rounded-md border p-2.5">
      <p className="text-caption text-text-tertiary">{label}</p>
      <p className="text-title-sm tabular">{money.plain(amount)}</p>
      <p className="text-caption text-text-tertiary tabular">{count} ta</p>
    </div>
  );
}
