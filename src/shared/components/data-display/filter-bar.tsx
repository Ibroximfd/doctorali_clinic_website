"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";

/**
 * The toolbar every list page opens with.
 *
 * One shell, so the search box, the date filter and the dropdowns line up at
 * the same height on every page and the primary action always sits at the far
 * right. `extra` holds the filters that are not needed on every visit: they
 * collapse behind "Filtrlar" on a narrow screen instead of wrapping into a
 * three-row wall of controls.
 */
export function FilterBar({
  children,
  extra,
  extraCount = 0,
  action,
  className,
}: {
  children: ReactNode;
  extra?: ReactNode;
  /** How many of the collapsed filters are active — shown on the button. */
  extraCount?: number;
  action?: ReactNode;
  className?: string;
}) {
  const [openExtra, setOpenExtra] = useState(false);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {children}

        {extra && (
          <Button
            variant="outline"
            onClick={() => setOpenExtra((value) => !value)}
            aria-expanded={openExtra}
            className={cn(
              "h-[38px] gap-2 xl:hidden",
              extraCount > 0 && "border-primary/35 bg-primary-soft/60 text-primary-dark",
            )}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtrlar
            {extraCount > 0 && (
              <span className="bg-primary text-primary-foreground text-label-xs flex size-[18px] items-center justify-center rounded-full">
                {extraCount}
              </span>
            )}
          </Button>
        )}

        {/* Everything above is a filter; everything after the spacer acts. */}
        {extra && (
          <div className="hidden flex-wrap items-center gap-2 xl:flex">{extra}</div>
        )}

        {action && (
          <>
            <div className="flex-1" />
            {action}
          </>
        )}
      </div>

      {extra && openExtra && (
        <div className="flex flex-wrap items-center gap-2 xl:hidden">{extra}</div>
      )}
    </div>
  );
}

const ALL = "__all__";

export interface FilterOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/**
 * A dropdown filter with its "everything" option built in.
 *
 * `null` is the unfiltered state everywhere in the app, but a `<Select>` cannot
 * hold null — so the sentinel lives here, once, instead of in every list page.
 */
export function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  allLabel,
  label,
  width = "w-[168px]",
  className,
}: {
  value: T | null;
  onChange: (value: T | null) => void;
  options: readonly FilterOption<T>[];
  allLabel: string;
  /** Accessible name — what this dropdown filters by ("To'lov turi"). */
  label: string;
  width?: string;
  className?: string;
}) {
  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => onChange(next === ALL ? null : (next as T))}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          "h-[38px]",
          width,
          value !== null &&
            "border-primary/35 bg-primary-soft/60 text-primary-dark [&_svg]:text-primary-dark",
          className,
        )}
      >
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Sorting is not a filter — same control, never painted as "active". */
export function SortSelect<T extends string>({
  value,
  onChange,
  options,
  width = "w-[190px]",
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly FilterOption<T>[];
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as T)}>
      <SelectTrigger aria-label="Saralash" className={cn("h-[38px]", width)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
