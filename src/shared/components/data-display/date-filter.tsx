"use client";

import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useState } from "react";
import type { DateRange as DayPickerRange } from "react-day-picker";

import { Button } from "@/shared/components/ui/button";
import { Calendar } from "@/shared/components/ui/calendar";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { DATE_PRESETS, matchPreset, singleDayRange } from "@/shared/domain/date-presets";
import type { DateRange } from "@/shared/domain/date-range";
import {
  isSingleDay,
  rangeLabel,
  rangeLabelShort,
} from "@/shared/domain/date-range-label";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  addDays,
  localMonthCaption,
  localWeekdayShort,
  monthShort,
  nowTashkent,
  shortDate,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

/**
 * THE date filter — one control for every list in the panel.
 *
 * Two things the desk does all day, and both have to be one click away: pin ONE
 * day ("what was sold on the 3rd?") and span a period ("1–15 sentabr"). They
 * live as two tabs of the same popover rather than two separate controls,
 * because a filter bar carrying a day picker AND a range picker makes the desk
 * decide which one to open before it can answer a question.
 *
 * The range tab holds its own DRAFT while the two ends are being picked, and
 * only reports a period once both are chosen. Feeding each click straight back
 * out was the bug that made a range impossible to select at all: the list
 * already had one day selected, so the calendar saw a COMPLETE range, and the
 * first click on any other day was read as "move that range's edge" — one
 * click, popover closed, wrong period.
 */
export function DateFilter({
  value,
  onChange,
  clearable = true,
  steppable = true,
  align = "start",
  className,
}: {
  value: DateRange | null;
  /** `null` means "no date limit" and is only ever passed when `clearable`. */
  onChange: (range: DateRange | null) => void;
  /** Whether "Butun davr" is offered — a list that must always be dated says no. */
  clearable?: boolean;
  /** The ‹ › arrows that walk one day at a time while a single day is picked. */
  steppable?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const narrow = useMediaQuery("(max-width: 47.98rem)");

  const single = value !== null && isSingleDay(value);
  const [mode, setMode] = useState<"day" | "range">(single ? "day" : "range");

  /**
   * Reopening on the tab that matches what is actually filtered: a desk that
   * pinned one day expects the day calendar to be there when they come back.
   */
  function handleOpenChange(next: boolean) {
    if (next) setMode(value !== null && single ? "day" : "range");
    setOpen(next);
  }

  const preset = matchPreset(value);
  const stepping = steppable && single && value !== null;

  function commit(range: DateRange | null) {
    onChange(range);
    setOpen(false);
  }

  function stepDay(delta: number) {
    if (!value) return;
    onChange(singleDayRange(addDays(value.start, delta)));
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {stepping && (
        <StepButton
          label="Oldingi kun"
          onClick={() => stepDay(-1)}
          icon={<ChevronLeft className="size-4" />}
        />
      )}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={`Sana filtri: ${triggerLabel(value, preset?.label)}`}
            className={cn(
              "h-[38px] min-w-0 gap-2 px-3",
              value !== null &&
                "border-primary/35 bg-primary-soft/60 text-primary-dark hover:bg-primary-soft",
            )}
          >
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{triggerLabel(value, preset?.label)}</span>
            <ChevronDown className="text-text-tertiary size-3.5 shrink-0" aria-hidden />
          </Button>
        </PopoverTrigger>

        <PopoverContent align={align} className="w-auto max-w-[min(95vw,46rem)] p-0">
          <div className="border-border flex items-center gap-1 border-b p-2">
            <ModeTab
              active={mode === "day"}
              onClick={() => setMode("day")}
              label="Bir kun"
            />
            <ModeTab
              active={mode === "range"}
              onClick={() => setMode("range")}
              label="Oraliq"
            />
            <div className="flex-1" />
            {clearable && value !== null && (
              <button
                type="button"
                onClick={() => commit(null)}
                className="text-caption text-text-tertiary hover:text-text-primary focus-visible:ring-ring flex items-center gap-1 rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-3.5" aria-hidden />
                Butun davr
              </button>
            )}
          </div>

          {/* The named periods first: they answer most questions without the
              calendar being read at all. */}
          <div className="border-border flex flex-wrap gap-1.5 border-b p-2">
            {DATE_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => commit(item.build(nowTashkent()))}
                className={cn(
                  "text-label-sm rounded-full px-3 py-1.5 transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  preset?.id === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-alt text-text-secondary hover:text-text-primary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {mode === "day" ? (
            <DayTab value={value} onPick={(day) => commit(singleDayRange(day))} />
          ) : (
            <RangeTab
              value={value}
              months={narrow ? 1 : 2}
              onApply={(range) => commit(range)}
            />
          )}
        </PopoverContent>
      </Popover>

      {stepping && (
        <StepButton
          label="Keyingi kun"
          onClick={() => stepDay(1)}
          icon={<ChevronRight className="size-4" />}
        />
      )}
    </div>
  );
}

/** What the button says: the period's name when it has one, else its dates. */
function triggerLabel(value: DateRange | null, presetLabel: string | undefined): string {
  if (value === null) return "Butun davr";
  return presetLabel ?? rangeLabelShort(value);
}

function StepButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="text-text-secondary size-[38px] shrink-0"
    >
      {icon}
    </Button>
  );
}

function ModeTab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "text-label-sm rounded-sm px-3 py-1.5 transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "bg-surface-alt text-primary-dark"
          : "text-text-secondary hover:text-text-primary",
      )}
    >
      {label}
    </button>
  );
}

/*
 * Month and year are DROPDOWNS, not a ‹ › walk. Reception files a backdated
 * order or checks last spring's sales often enough that eighteen clicks on an
 * arrow is its own reason not to use the filter.
 */
const CALENDAR_PROPS = {
  weekStartsOn: 1,
  captionLayout: "dropdown",
  startMonth: new Date(2020, 0),
  endMonth: new Date(new Date().getFullYear() + 2, 11),
  formatters: {
    formatCaption: localMonthCaption,
    formatWeekdayName: localWeekdayShort,
    // Without this the month dropdown falls back to the browser's locale and
    // reads "Sep" in an otherwise Uzbek calendar.
    formatMonthDropdown: (date: Date) => monthShort(date.getMonth() + 1),
  },
} as const;

function DayTab({
  value,
  onPick,
}: {
  value: DateRange | null;
  onPick: (day: TashkentDate) => void;
}) {
  const selected = value ? toLocalDay(value.start) : undefined;
  return (
    <div className="flex flex-col">
      <Calendar
        mode="single"
        selected={selected}
        defaultMonth={selected}
        onSelect={(day) => day && onPick(fromLocalDay(day))}
        autoFocus
        {...CALENDAR_PROPS}
      />
      {value && (
        <p className="border-border text-caption text-text-secondary border-t px-3 py-2">
          {rangeLabel(value)}
        </p>
      )}
    </div>
  );
}

/**
 * The range tab: pick a start, pick an end, apply.
 *
 * Both ends are also TYPEABLE. Clicking back to March takes two dropdown
 * changes; typing `01.03.2026` takes one field — and reception reads dates off
 * paper far more often than off a screen.
 */
function RangeTab({
  value,
  months,
  onApply,
}: {
  value: DateRange | null;
  months: number;
  onApply: (range: DateRange) => void;
}) {
  // Seeded from the current filter, then owned locally until "Qo'llash": the
  // list must not re-query on the first of the two clicks.
  /*
   * Seeded ONLY from a real period. A single day (what most lists open on) is
   * not a period the desk is editing — seeding it as a half-picked range made
   * the first click close the range against it: open "Oraliq" on today, click
   * the 3rd, and out came "3–10" instead of a range starting on the 3rd.
   */
  const [draft, setDraft] = useState<DayPickerRange | undefined>(() =>
    value && !isSingleDay(value)
      ? { from: toLocalDay(value.start), to: toLocalDay(addDays(value.end, -1)) }
      : undefined,
  );

  const complete = Boolean(draft?.from && draft.to);

  /**
   * Deliberately NOT `addToRange`: with a complete range on screen that helper
   * moves the nearest edge, so a first click already produced a period. Here a
   * click either starts a range or closes one, which is what a person expects.
   */
  function handleDayClick(day: Date | undefined) {
    if (!day) return;

    // Click one starts the period over, whatever was on screen before.
    if (!draft?.from || draft.to) {
      setDraft({ from: day, to: undefined });
      return;
    }

    // Click two closes it — backwards too, so picking the end first is fine.
    const [from, to] = draft.from <= day ? [draft.from, day] : [day, draft.from];
    setDraft({ from, to });
    onApply({ start: fromLocalDay(from), end: addDays(fromLocalDay(to), 1) });
  }

  function apply() {
    if (!draft?.from) return;
    const start = fromLocalDay(draft.from);
    const lastDay = fromLocalDay(draft.to ?? draft.from);
    onApply({ start, end: addDays(lastDay, 1) });
  }

  return (
    <div className="flex flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b p-2">
        <DayField
          label="Boshlanishi"
          day={draft?.from}
          onChange={(day) => setDraft({ from: day, to: draft?.to })}
          active={!complete}
        />
        <ArrowRight className="text-text-tertiary size-4 shrink-0" aria-hidden />
        <DayField
          label="Tugashi"
          day={draft?.to}
          onChange={(day) =>
            setDraft(
              draft?.from && draft.from <= day
                ? { from: draft.from, to: day }
                : { from: day, to: draft?.from },
            )
          }
          active={complete}
        />
      </div>

      <Calendar
        mode="range"
        numberOfMonths={months}
        selected={draft}
        defaultMonth={draft?.from ?? (value ? toLocalDay(value.start) : undefined)}
        onSelect={(_range, clickedDay) => handleDayClick(clickedDay)}
        autoFocus
        {...CALENDAR_PROPS}
      />

      <div className="border-border flex items-center gap-2 border-t p-2">
        <p className="text-caption text-text-secondary min-w-0 flex-1 truncate">
          {!draft?.from
            ? "Boshlanish sanasini tanlang"
            : !draft.to
              ? "Endi tugash sanasini bosing"
              : rangeLabel({
                  start: fromLocalDay(draft.from),
                  end: addDays(fromLocalDay(draft.to), 1),
                })}
        </p>
        {draft?.from && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDraft(undefined)}
            className="text-text-tertiary"
          >
            Tozalash
          </Button>
        )}
        <Button size="sm" onClick={apply} disabled={!draft?.from}>
          Qo&rsquo;llash
        </Button>
      </div>
    </div>
  );
}

/** One typed end of the range — `dd.mm.yyyy`, dots inserted while typing. */
function DayField({
  label,
  day,
  onChange,
  active,
}: {
  label: string;
  day: Date | undefined;
  onChange: (day: Date) => void;
  active: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (day ? shortDate(fromLocalDay(day)) : "");

  function commitText(raw: string) {
    const parsed = parseTypedDay(raw);
    if (parsed) {
      onChange(parsed);
      setText(null);
    } else if (raw.trim() === "") {
      setText(null);
    }
  }

  return (
    <label className="min-w-0 flex-1">
      <span className="text-label-xs text-text-tertiary block">{label}</span>
      <Input
        inputMode="numeric"
        value={shown}
        placeholder="kk.oo.yyyy"
        onChange={(event) => setText(maskDayInput(event.target.value))}
        onBlur={(event) => commitText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitText(event.currentTarget.value);
          }
        }}
        className={cn(
          "tabular h-8 w-[120px] px-2",
          active && "border-primary/50 ring-primary/15 ring-2",
        )}
      />
    </label>
  );
}

/** `1092026` → `10.09.2026`, as it is typed. */
function maskDayInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter((part) => part !== "").join(".");
}

/** A typed `dd.mm.yyyy`, or null while it is still half-written or impossible. */
function parseTypedDay(raw: string): Date | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 8) return null;

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  // Rejects the 31st of a 30-day month, which JS would roll into the next one.
  return date.getDate() === day && date.getMonth() === month - 1 ? date : null;
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
