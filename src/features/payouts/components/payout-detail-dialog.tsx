"use client";

import { Ban } from "lucide-react";

import { CommissionBreakdownLine } from "@/shared/components/data-display/commission-breakdown-line";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { dayMonth, dayMonthYear, dayMonthYearTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { usePayoutQuery } from "../hooks/use-payouts";
import { PAYOUT_STATUS_LABEL, type Payout } from "../types/payout";
import { PayoutBreakdown } from "./payout-breakdown";

/**
 * A payout already made, opened day → order → product.
 *
 * The same drill-down the week had before it was paid, so "why is this figure
 * what it is?" is answerable AFTER the money changed hands — which is when a
 * doctor actually asks it. A paid week can still be reversed from here; the
 * week then returns to the outstanding list.
 */
export function PayoutDetailDialog({
  payoutId,
  open,
  onOpenChange,
  onCancelPayout,
}: {
  payoutId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the reason dialog the cancel is audited by. */
  onCancelPayout?: (payout: Payout) => void;
}) {
  const { data, error, isPending, refetch } = usePayoutQuery(open ? payoutId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{data?.doctor.fullName ?? "To'lov"}</DialogTitle>
          <DialogDescription>
            {data
              ? `${dayMonth(data.weekStart)} – ${dayMonthYear(data.weekEnd)} · ${data.commissionCount} ta komissiya`
              : "Yuklanmoqda…"}
          </DialogDescription>
        </DialogHeader>

        {error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !data ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 rounded-md" />
            ))}
          </div>
        ) : (
          <>
            <div className="bg-surface-alt rounded-md p-4">
              <div className="flex items-baseline gap-2">
                <p className="text-caption text-text-secondary">
                  {data.status === "paid" ? "To'langan" : "Bekor qilingan"}
                </p>
                <span
                  className={cn(
                    "text-label-xs ml-auto rounded-full px-2 py-0.5",
                    data.status === "paid"
                      ? "bg-primary-soft text-primary-dark"
                      : "bg-danger/12 text-danger",
                  )}
                >
                  {PAYOUT_STATUS_LABEL[data.status]}
                </span>
              </div>
              <p className="text-display-sm tabular mt-1">
                {money.plain(data.totalAmount)}
              </p>
              <CommissionBreakdownLine
                breakdown={data.commissionBreakdown}
                className="mt-1.5"
              />
              <dl className="text-caption text-text-tertiary mt-2 flex flex-col gap-0.5">
                {data.paidAt && (
                  <div className="flex gap-2">
                    <dt>Sana</dt>
                    <dd className="tabular ml-auto">{dayMonthYearTime(data.paidAt)}</dd>
                  </div>
                )}
                {data.paidByName !== "" && (
                  <div className="flex gap-2">
                    <dt>Kim to&rsquo;ladi</dt>
                    <dd className="ml-auto">{data.paidByName}</dd>
                  </div>
                )}
                {data.note !== "" && (
                  <div className="flex gap-2">
                    <dt>Izoh</dt>
                    <dd className="ml-auto text-right">{data.note}</dd>
                  </div>
                )}
                {data.cancelledReason !== "" && (
                  <div className="text-danger flex gap-2">
                    <dt>Bekor qilish sababi</dt>
                    <dd className="ml-auto text-right">{data.cancelledReason}</dd>
                  </div>
                )}
              </dl>
            </div>

            <PayoutBreakdown days={data.days} />
          </>
        )}

        {data && data.status === "paid" && onCancelPayout && (
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onCancelPayout(data);
              }}
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Ban className="size-4" aria-hidden />
              To&rsquo;lovni bekor qilish
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
