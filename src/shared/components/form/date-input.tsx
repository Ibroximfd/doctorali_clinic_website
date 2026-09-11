"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import type { Matcher } from "react-day-picker";

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { dayMonthYear, type TashkentDate } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

/**
 * A single-day picker.
 *
 * Converts between the app's Tashkent frame (wall clock in UTC fields) and the
 * calendar's local-day frame, so clicking "9" always means the 9th whatever
 * zone the machine is in.
 */
export function DateInput({
  value,
  onChange,
  label,
  placeholder = "Sana tanlang",
  disabled,
  id,
  className,
  fromDate,
  toDate,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  value: TashkentDate | null;
  onChange: (date: TashkentDate) => void;
  /** Overrides the printed date — "Bugun · 11 sentabr 2026" and the like. */
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Earliest selectable day — a debt deadline can never be in the past. */
  fromDate?: TashkentDate;
  toDate?: TashkentDate;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          className={cn(
            "h-[46px] w-full justify-start gap-2.5 px-3.5 font-semibold",
            value === null && "text-text-tertiary font-normal",
            className,
          )}
        >
          <CalendarDays className="text-text-tertiary size-4" aria-hidden />
          {label ?? (value ? dayMonthYear(value) : placeholder)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? toLocalDay(value) : undefined}
          defaultMonth={value ? toLocalDay(value) : undefined}
          onSelect={(day) => {
            if (!day) return;
            onChange(fromLocalDay(day));
            setOpen(false);
          }}
          disabled={disabledMatchers(fromDate, toDate)}
          weekStartsOn={1}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * `react-day-picker` wants each bound as its own matcher; a single object with
 * `undefined` halves is not a valid `Matcher`.
 */
function disabledMatchers(
  fromDate?: TashkentDate,
  toDate?: TashkentDate,
): Matcher[] | undefined {
  const matchers: Matcher[] = [];
  if (fromDate) matchers.push({ before: toLocalDay(fromDate) });
  if (toDate) matchers.push({ after: toLocalDay(toDate) });
  return matchers.length > 0 ? matchers : undefined;
}

function toLocalDay(d: TashkentDate): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function fromLocalDay(d: Date): TashkentDate {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) as TashkentDate;
}
