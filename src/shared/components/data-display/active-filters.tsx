"use client";

import { X, type LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

export interface ActiveFilter {
  readonly id: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  /** The period chip is emphasised: it is the one filter always in force. */
  readonly emphasized?: boolean;
  readonly onClear?: () => void;
  readonly onClick?: () => void;
}

/**
 * The line under a filter bar that spells out what is actually narrowing the
 * list.
 *
 * This exists because of a real failure mode: a filter left on from an hour ago
 * silently makes today's figures look wrong, and reception then reports a bug
 * that is really a stale chip.
 */
export function ActiveFilters({
  filters,
  onClearAll,
  className,
}: {
  filters: readonly ActiveFilter[];
  onClearAll?: () => void;
  className?: string;
}) {
  if (filters.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-caption text-text-tertiary">Filtr:</span>
      {filters.map((filter) => {
        const Icon = filter.icon;
        return (
          <span
            key={filter.id}
            className={cn(
              "text-label-sm inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
              filter.emphasized
                ? "bg-primary-soft text-primary-dark"
                : "bg-surface-alt text-text-secondary",
            )}
          >
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {filter.onClick ? (
              <button
                type="button"
                onClick={filter.onClick}
                className="focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {filter.label}
              </button>
            ) : (
              filter.label
            )}
            {filter.onClear && (
              <button
                type="button"
                onClick={filter.onClear}
                aria-label={`${filter.label} filtrini olib tashlash`}
                className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        );
      })}
      {onClearAll && filters.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-caption text-text-tertiary hover:text-text-primary focus-visible:ring-ring rounded-sm px-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          Barchasini tozalash
        </button>
      )}
    </div>
  );
}
