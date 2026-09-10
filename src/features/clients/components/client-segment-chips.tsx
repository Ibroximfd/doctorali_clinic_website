"use client";

import { cn } from "@/shared/lib/utils";

import {
  CLIENT_SEGMENTS,
  CLIENT_SEGMENT_LABEL,
  type ClientSegment,
} from "../api/clients-crm-api";

/**
 * Debtor segments borrow the debt palette, so a chip's meaning is legible
 * before its label is read.
 */
const TONE: Readonly<Record<ClientSegment, string>> = {
  all: "border-primary bg-primary/12 text-primary-dark",
  vip: "border-gold bg-gold/12 text-gold",
  debtors: "border-warning bg-warning/12 text-warning",
  overdue: "border-danger bg-danger/12 text-danger",
  new: "border-primary bg-primary/12 text-primary-dark",
  lost: "border-text-secondary bg-surface-alt text-text-secondary",
};

/**
 * One-tap segments above the list.
 *
 * Each is a question reception actually asks — who owes me money, who has
 * stopped coming, who is new — turned into a single tap instead of a
 * three-dropdown expedition through the filter bar.
 */
export function ClientSegmentChips({
  value,
  onChange,
}: {
  value: ClientSegment;
  onChange: (segment: ClientSegment) => void;
}) {
  return (
    <div role="tablist" aria-label="Segment" className="flex flex-wrap gap-2">
      {CLIENT_SEGMENTS.map((segment) => {
        const selected = value === segment;
        return (
          <button
            key={segment}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(segment)}
            className={cn(
              "text-label-sm rounded-full border px-3 py-1.5 transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? TONE[segment]
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {CLIENT_SEGMENT_LABEL[segment]}
          </button>
        );
      })}
    </div>
  );
}
