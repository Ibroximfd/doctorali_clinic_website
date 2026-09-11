"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";

import { DateInput } from "@/shared/components/form/date-input";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  addDays,
  dayMonthYear,
  hhmm,
  isToday,
  nowTashkent,
  startOfDay,
  withTimeOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";

import {
  selectEffectiveOrderDate,
  selectIsEditing,
  useNewOrderStore,
} from "../store/new-order-store";

/**
 * Which day this sale is filed under.
 *
 * Two rules it exists to keep:
 *
 * 1. **An edit opens on the order's OWN day**, not on today. The field used to
 *    read the raw `orderDate`, which an edit leaves empty — so every order ever
 *    opened for editing looked like it belonged to today.
 * 2. **Moving the day never moves the clock.** The picker hands back midnight;
 *    the time of day is carried over from the order itself, so a sale rung up at
 *    16:40 stays at 16:40 instead of jumping to 00:00 and landing at the top of
 *    the day's list.
 *
 * Leaving it alone sends no date at all, which is what keeps an untouched edit
 * byte-for-byte on the timestamp the server already has.
 */
export function OrderDateField() {
  const state = useNewOrderStore();
  const { orderDate, setOrderDate, editingOrder } = state;

  const editing = selectIsEditing(state);
  const today = startOfDay(nowTashkent());
  // Never null: an edit falls back to the order's day, a new sale to today.
  const current = selectEffectiveOrderDate(state) ?? nowTashkent();
  const backdated = !isToday(current);

  function pick(day: TashkentDate) {
    const composed = withTimeOfDay(day, current);
    // A new sale filed under today sends nothing and lets the server stamp the
    // real moment. An edit always sends the date — that is how an order moves
    // back to today.
    setOrderDate(isToday(day) && !editing ? null : composed);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor="order-date">Buyurtma sanasi</Label>
        {orderDate !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOrderDate(null)}
            className="text-text-tertiary -my-1 ml-auto h-7 px-2"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {editing ? "Asl sanaga qaytarish" : "Bugunga qaytarish"}
          </Button>
        )}
      </div>

      <DateInput
        id="order-date"
        value={current}
        onChange={pick}
        label={
          backdated
            ? `${dayMonthYear(current)} · ${hhmm(current)}`
            : `Bugun · ${dayMonthYear(current)}`
        }
        // The server refuses anything older than a year (`backdate_too_old`),
        // so the calendar doesn't offer it either, and a sale cannot be filed
        // in the future.
        fromDate={addDays(today, -365)}
        toDate={today}
        className={backdated ? "border-warning bg-warning/8" : undefined}
      />

      {backdated && (
        <p className="text-caption text-warning flex items-center gap-1.5">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
          {editing && orderDate === null
            ? `Buyurtma ${dayMonthYear(current)} kuniga yozilgan — saqlash uchun PIN-kod so'raladi`
            : "Boshqa kunga yozish uchun PIN-kod so'raladi"}
        </p>
      )}

      {/* The exact moment the order carries, so the desk can see the clock it
          is keeping — and that a day change did not touch it. */}
      {editing && editingOrder && (
        <p className="text-caption text-text-tertiary tabular">
          Asl vaqti: {dayMonthYear(editingOrder.createdAt)} ·{" "}
          {hhmm(editingOrder.createdAt)}
        </p>
      )}
    </div>
  );
}
