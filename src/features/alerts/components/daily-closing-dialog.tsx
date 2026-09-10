"use client";

import { CheckCircle2, Download, Lock, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { MoneyInput } from "@/shared/components/form/money-input";
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
import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  dayMonthYear,
  hhmm,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import {
  useCloseDay,
  useDailyClosingExport,
  useDailyClosingQuery,
} from "../hooks/use-alerts";
import {
  expectedCash,
  tillLabel,
  tillLines,
  type DailyClosingReport,
} from "../types/daily-closing";

/**
 * "Kunni yopish" — the handover sheet.
 *
 * The point of the screen is one comparison: what the drawer SHOULD hold
 * against what was actually counted in it. Everything else is context for that
 * number, which is why the difference is the loudest thing on it.
 */
export function DailyClosingDialog({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Reads an earlier day, to reprint it or close it late; null is today. */
  date?: TashkentDate | null;
}) {
  const report = useDailyClosingQuery(date ?? null, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Kunni yopish</DialogTitle>
          <DialogDescription>
            {report.data ? dayMonthYear(startOfDay(nowTashkent())) : "Kunlik hisobot"}
          </DialogDescription>
        </DialogHeader>

        {report.error && !report.data ? (
          <ErrorState error={report.error} onRetry={() => void report.refetch()} />
        ) : report.isPending || !report.data ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-[120px] rounded-md" />
            <Skeleton className="h-[160px] rounded-md" />
          </div>
        ) : (
          <ClosingBody
            report={report.data}
            date={date ?? startOfDay(nowTashkent())}
            onClosed={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ClosingBody({
  report,
  date,
  onClosed,
}: {
  report: DailyClosingReport;
  date: TashkentDate;
  onClosed: () => void;
}) {
  const close = useCloseDay();
  const exportReport = useDailyClosingExport();
  const pinGate = usePinGate();

  const expected = expectedCash(report);
  const [counted, setCounted] = useState<number>(report.countedCash ?? expected);
  const [note, setNote] = useState("");

  const difference = counted - expected;
  const tills = tillLines(report);

  function submit(confirmPin?: string) {
    void close
      .mutateAsync({ date, countedCash: counted, note, confirmPin })
      .then(onClosed);
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {report.closed && (
          <p className="bg-success/10 text-caption text-success flex items-center gap-2 rounded-md p-3">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Kun yopilgan
            {report.closedAt && ` · ${hhmm(report.closedAt)}`}
            {report.closedBy !== "" && ` · ${report.closedBy}`}
          </p>
        )}

        {/* A backdated order landing on a closed day means the figure the shift
            signed for is no longer the current one — worth saying out loud. */}
        {report.reopened && (
          <p className="bg-warning/10 text-caption text-warning flex items-center gap-2 rounded-md p-3">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            Kun yopilgandan keyin o&rsquo;zgargan — qaytadan yopish kerak.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Buyurtma" value={String(report.ordersCount)} />
          <Figure label="Muolaja" value={String(report.treatmentsCount)} />
          <Figure label="Tushum" value={money.compact(report.totalCollected)} />
          <Figure label="Xarajat" value={money.compact(report.expenses)} />
        </div>

        <div className="border-border overflow-hidden rounded-md border">
          <div className="border-border bg-surface-alt/40 grid grid-cols-[minmax(0,1fr)_repeat(3,90px)] gap-2 border-b px-3 py-2">
            {["Kassa", "Kirim", "Chiqim", "Qoldiq"].map((label, i) => (
              <span
                key={label}
                className={cn(
                  "text-label-xs text-text-tertiary uppercase",
                  i > 0 && "text-right",
                )}
              >
                {label}
              </span>
            ))}
          </div>
          {tills.map((line) => (
            <div
              key={line.type ?? "unspecified"}
              className="border-border/60 grid grid-cols-[minmax(0,1fr)_repeat(3,90px)] gap-2 border-b px-3 py-2 last:border-b-0"
            >
              <span className="text-body-sm truncate">{tillLabel(line)}</span>
              <span className="text-body-sm tabular text-right">
                {money.plain(line.collected)}
              </span>
              <span className="text-body-sm text-danger tabular text-right">
                {line.spent > 0 ? `−${money.plain(line.spent)}` : "—"}
              </span>
              <span className="text-title-sm tabular text-right">
                {money.plain(line.net)}
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="counted-cash">Sanalgan naqd pul</Label>
            <MoneyInput
              id="counted-cash"
              value={counted}
              onValueChange={setCounted}
              className="h-[46px]"
            />
            <p className="text-caption text-text-tertiary tabular">
              Bo&rsquo;lishi kerak: {money.uzs(expected)}
            </p>
          </div>

          <div
            className={cn(
              "flex flex-col justify-center rounded-md border p-3",
              difference === 0
                ? "border-success/30 bg-success/10 text-success"
                : difference < 0
                  ? "border-danger/30 bg-danger/10 text-danger"
                  : "border-warning/30 bg-warning/10 text-warning",
            )}
          >
            <span className="text-label-xs opacity-80">Farq</span>
            <span className="text-headline-sm tabular">
              {difference > 0 ? "+" : ""}
              {money.plain(difference)}
            </span>
            <span className="text-caption opacity-80">
              {difference === 0
                ? "Kassa to'g'ri"
                : difference < 0
                  ? "Kam chiqdi"
                  : "Ortiqcha chiqdi"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Figure label="Qarz berildi" value={money.compact(report.debtIssued)} />
          <Figure label="Qarz qaytdi" value={money.compact(report.debtCollected)} />
          <Figure
            label="Ochiq qarz"
            value={money.compact(report.debtOutstanding)}
            tone={report.debtOverdue > 0 ? "text-warning" : undefined}
          />
          <Figure label="Ertaga tashrif" value={String(report.tomorrowAppointments)} />
        </div>

        {report.failedNotifications > 0 && (
          <p className="text-caption text-warning">
            {report.failedNotifications} ta xabar mijozga yetib bormadi — ularga
            qo&rsquo;ng&rsquo;iroq qilish kerak.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="closing-note">Izoh</Label>
          <Textarea
            id="closing-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Farq sababi yoki smena haqida"
          />
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={exportReport.isPending}
          onClick={() => exportReport.mutate({ date, format: "pdf" })}
        >
          <Download className="size-4" aria-hidden />
          PDF
        </Button>
        <Button
          type="button"
          disabled={close.isPending}
          onClick={() => {
            // Closing an already-closed day is a re-close, which the backend
            // gates behind the PIN — asked for here rather than after a refusal.
            if (report.closed) pinGate.requestPin((pin) => submit(pin));
            else submit();
          }}
        >
          {report.closed ? (
            <Lock className="size-4" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4" aria-hidden />
          )}
          {report.closed ? "Qayta yopish" : "Kunni yopish"}
        </Button>
      </DialogFooter>

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        title="Kunni qayta yopish"
        description="Yopilgan kunni qayta yopish uchun PIN kodni kiriting."
      />
    </>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="border-border bg-surface-alt rounded-md border p-2.5">
      <p className={cn("text-title-sm tabular", tone)}>{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}
