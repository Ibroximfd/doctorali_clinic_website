import { Building2 } from "lucide-react";

import type { FilialRef } from "@/shared/domain/filial";
import { cn } from "@/shared/lib/utils";

/**
 * Small branch label on a row. Renders nothing for a row without a branch, so
 * callers can drop it in unconditionally.
 */
export function FilialTag({
  filial,
  className,
}: {
  filial: FilialRef | null;
  className?: string;
}) {
  if (filial === null) return null;
  return (
    <span
      className={cn(
        "bg-surface-alt text-label-xs text-text-tertiary inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5",
        className,
      )}
    >
      <Building2 aria-hidden className="size-3" />
      {filial.name}
    </span>
  );
}
