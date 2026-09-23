import { Fragment } from "react";

import {
  breakdownSegments,
  isBreakdownInformative,
  segmentAmount,
  type CommissionBreakdown,
} from "@/shared/domain/commission-breakdown";
import { cn } from "@/shared/lib/utils";

/**
 * The line under a commission figure that says where it came from:
 * `Mahsulot 40 000 · Muolaja 30 000 · Tuzatish −5 000`.
 *
 * Renders nothing when the payload has no breakdown, or when the split would
 * only repeat the figure it sits under — so a week that is pure product sales
 * stays as quiet as it was before this existed.
 *
 * The root is a `span`, not a `p`: this line lives inside buttons, table rows
 * and captions, where block content would be invalid markup.
 */
export function CommissionBreakdownLine({
  breakdown,
  className,
}: {
  breakdown: CommissionBreakdown | null;
  className?: string;
}) {
  if (breakdown === null || !isBreakdownInformative(breakdown)) return null;

  return (
    <span
      className={cn(
        "text-caption text-text-tertiary flex flex-wrap items-baseline gap-x-1.5",
        className,
      )}
    >
      {breakdownSegments(breakdown).map((segment, index) => (
        <Fragment key={segment.key}>
          {index > 0 && <span aria-hidden>·</span>}
          <span className={cn("tabular", segment.amount < 0 && "text-danger")}>
            {segment.label} {segmentAmount(segment)}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
