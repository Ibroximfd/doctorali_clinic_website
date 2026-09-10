"use client";

import { CalendarPlus } from "lucide-react";
import { useState } from "react";

import { DateInput } from "@/shared/components/form/date-input";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import {
  addDays,
  dayMonthYear,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { useExtendDebt } from "../hooks/use-debts";
import type { Debt } from "../types/debt";

/** The backend's own ceiling (`due_date_extend_limit`). */
const EXTEND_LIMIT = 3;

/**
 * Moves a deadline forward.
 *
 * The backend allows this at most three times and only ever forward, so the
 * dialog says which extension this is and refuses to offer a past date — a
 * refusal the desk can see before it sends, rather than after.
 */
export function DebtExtendDialog({
  debt,
  open,
  onOpenChange,
}: {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const extend = useExtendDebt();
  const [dueDate, setDueDate] = useState<TashkentDate | null>(null);
  const [note, setNote] = useState("");

  useResetOnChange(open ? (debt?.id ?? null) : null, () => {
    if (!open || !debt) return;
    setDueDate(addDays(debt.dueDate, 7));
    setNote(debt.note);
  });

  if (!debt) return null;

  const used = debt.dueDateChangedCount;
  const exhausted = used >= EXTEND_LIMIT;
  const tomorrow = addDays(startOfDay(nowTashkent()), 1);
  const invalid = dueDate === null || dueDate <= debt.dueDate;

  async function submit() {
    if (invalid || !debt || dueDate === null) return;
    await extend.mutateAsync({ id: debt.id, dueDate, note });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Muddatni uzaytirish</DialogTitle>
          <DialogDescription>
            Joriy muddat: {dayMonthYear(debt.dueDate)} · uzaytirilgan {used}/
            {EXTEND_LIMIT}
          </DialogDescription>
        </DialogHeader>

        {exhausted ? (
          <p
            role="alert"
            className="border-warning/40 bg-warning/10 text-body-sm text-warning rounded-md border p-3"
          >
            Bu qarz muddati {EXTEND_LIMIT} marta uzaytirilgan. Yana uzaytirish uchun
            administratorga murojaat qiling.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="due-date">Yangi muddat</Label>
              <DateInput
                id="due-date"
                value={dueDate}
                onChange={setDueDate}
                fromDate={
                  addDays(debt.dueDate, 1) > tomorrow
                    ? addDays(debt.dueDate, 1)
                    : tomorrow
                }
                aria-invalid={invalid}
              />
              {invalid && dueDate !== null && (
                <p role="alert" className="text-caption text-danger">
                  Yangi muddat joriy muddatdan keyin bo&rsquo;lishi kerak
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="extend-note">Izoh</Label>
              <Textarea
                id="extend-note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Nima uchun uzaytirilyapti?"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          {!exhausted && (
            <Button onClick={submit} disabled={invalid || extend.isPending}>
              <CalendarPlus className="size-4" aria-hidden />
              Uzaytirish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
