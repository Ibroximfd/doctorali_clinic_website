"use client";

import { CalendarRange } from "lucide-react";
import { useState } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { DateRange } from "@/shared/domain/date-range";
import { rangeTriggerLabel } from "@/shared/domain/date-range-label";
import { addDays, startOfDay, type TashkentDate } from "@/shared/lib/format/date";

/**
 * Picks a custom period.
 *
 * The app's ranges are inclusive-start / **exclusive-end**, while a calendar
 * picker thinks in inclusive days — so the conversion happens here, once, at
 * the boundary. Everything downstream keeps the app's convention.
 *
 * Quick presets sit beside the calendar because the desk almost always wants
 * "last 7 days" or "this month", not an arbitrary span.
 */
export function DateRangePicker({
  value,
  onChange,
  triggerLabel,
}: {
  value: DateRange | null;
  onChange: (range: DateRange) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  // Calendar days are the INCLUSIVE range: end − 1.
  const selected: DayPickerRange | undefined = value
    ? { from: toLocalDay(value.start), to: toLocalDay(addDays(value.end, -1)) }
    : undefined;

  function commit(range: DayPickerRange | undefined) {
    if (!range?.from) return;
    const from = fromLocalDay(range.from);
    const toInclusive = fromLocalDay(range.to ?? range.from);
    onChange({ start: from, end: addDays(toInclusive, 1) });
    if (range.to) setOpen(false);
  }

  /** The last `days` days, ending today. */
  function preset(days: number) {
    const today = startOfDay(nowLocalAsTashkent());
    onChange({ start: addDays(today, -(days - 1)), end: addDays(today, 1) });
    setOpen(false);
  }

  /** One single day, `back` days ago — 0 is today, 1 is yesterday. */
  function singleDay(back: number) {
    const day = addDays(startOfDay(nowLocalAsTashkent()), -back);
    onChange({ start: day, end: addDays(day, 1) });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarRange className="size-4" aria-hidden />
          {triggerLabel ?? (value ? rangeTriggerLabel(value) : "Butun davr")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        {/* "Bugun" leads: the lists open on today, so returning to it is the
            move the desk makes most and it should be the first button. */}
        <div className="border-border flex flex-wrap gap-1 border-b p-2">
          <Button variant="ghost" size="sm" onClick={() => singleDay(0)}>
            Bugun
          </Button>
          <Button variant="ghost" size="sm" onClick={() => singleDay(1)}>
            Kecha
          </Button>
          <Button variant="ghost" size="sm" onClick={() => preset(7)}>
            Oxirgi 7 kun
          </Button>
          <Button variant="ghost" size="sm" onClick={() => preset(30)}>
            Oxirgi 30 kun
          </Button>
          <Button variant="ghost" size="sm" onClick={() => preset(90)}>
            Oxirgi 90 kun
          </Button>
        </div>
        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={selected?.from}
          selected={selected}
          onSelect={commit}
          weekStartsOn={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * A Tashkent instant carries its wall clock in UTC fields; `react-day-picker`
 * works in the browser's local zone. These two convert between the frames so a
 * click on "9" always means the 9th, whatever zone the machine is in.
 */
function toLocalDay(d: TashkentDate): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fromLocalDay(d: Date): TashkentDate {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) as TashkentDate;
}

function nowLocalAsTashkent(): TashkentDate {
  const now = new Date(Date.now() + 5 * 60 * 60 * 1000);
  return now as TashkentDate;
}
