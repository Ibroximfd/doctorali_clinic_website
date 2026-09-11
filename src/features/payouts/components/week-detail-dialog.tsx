"use client";

import { HandCoins, TriangleAlert } from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { dayMonth, dayMonthYear } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { usePayWeek, useWeekDetailQuery } from "../hooks/use-payouts";
import { balanceCaption, balanceExplanation, balanceOf } from "../types/payout";
import { PayoutBreakdown } from "./payout-breakdown";

/**
 * One doctor-week, opened day → order → product, before it is cashed out.
 *
 * The corrections (`adjustments`) are shown inline with the day they land on,
 * because a week that comes out lower than the doctor expects is almost always
 * a correction from an earlier week — and that is the conversation this dialog
 * exists to settle.
 */
export function WeekDetailDialog({
  doctorId,
  weekStart,
  open,
  onOpenChange,
}: {
  doctorId: string | null;
  weekStart: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isPending, refetch } = useWeekDetailQuery(
    open ? doctorId : null,
    open ? weekStart : null,
  );
  const pay = usePayWeek();
  const [note, setNote] = useState("");

  const balance = data ? balanceOf(data.totalAmount) : "settled";
  const explanation = balanceExplanation(balance);

  async function submit() {
    if (!data || doctorId === null || weekStart === null) return;
    await pay.mutateAsync({ doctorId, weekStart, note });
    setNote("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{data?.doctor.fullName ?? "Hafta"}</DialogTitle>
          <DialogDescription>
            {data
              ? `${dayMonth(data.weekStart)} – ${dayMonthYear(data.weekEnd)} · ${data.commissionCount} ta komissiya`
              : "Yuklanmoqda…"}
          </DialogDescription>
        </DialogHeader>

        {error ? (
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
              <p className="text-caption text-text-secondary">
                {balanceCaption(balance)}
              </p>
              <p
                className={cn(
                  "text-display-sm tabular mt-1",
                  balance === "owed_by_doctor" && "text-danger",
                )}
              >
                {money.plain(Math.abs(data.totalAmount))}
              </p>
              {explanation && (
                <p className="text-caption text-warning mt-2 flex items-start gap-2">
                  <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
                  {explanation}
                </p>
              )}
            </div>

            <PayoutBreakdown days={data.days} />

            {!data.isPaid && (
              <div className="space-y-1.5">
                <Label htmlFor="payout-note">Izoh</Label>
                <Textarea
                  id="payout-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ixtiyoriy"
                />
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Yopish
          </Button>
          {data && !data.isPaid && (
            <Button onClick={submit} disabled={pay.isPending}>
              {pay.isPending ? (
                <span
                  className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                  aria-hidden
                />
              ) : (
                <HandCoins className="size-4" aria-hidden />
              )}
              To&rsquo;landi deb belgilash
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
