import { CheckCircle2, FileText, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { STOCK_DOC_STATUS_LABEL, type StockDocStatus } from "../types/stock";

const ICON: Readonly<Record<StockDocStatus, LucideIcon>> = {
  draft: FileText,
  confirmed: CheckCircle2,
  cancelled: XCircle,
};

const TONE: Readonly<Record<StockDocStatus, string>> = {
  draft: "bg-surface-alt text-text-secondary",
  confirmed: "bg-success/12 text-success",
  cancelled: "bg-danger/12 text-danger",
};

/**
 * A document's state.
 *
 * Draft is deliberately the quiet one: it has moved nothing, so it should not
 * look like an event that happened.
 */
export function DocStatusChip({
  status,
  className,
}: {
  status: StockDocStatus;
  className?: string;
}) {
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "text-label-xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {STOCK_DOC_STATUS_LABEL[status]}
    </span>
  );
}
