"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

/**
 * Page controls under a table.
 *
 * Shows the row window ("1–20 / 134") rather than page numbers alone: at the
 * desk the useful question is "how many are there", not "which page is this".
 */
export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  busy,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  busy?: boolean;
  className?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "border-border bg-surface-alt/40 flex items-center gap-2 border-t px-5 py-3",
        className,
      )}
    >
      <span className="text-caption text-text-tertiary tabular">
        {first}–{last} / {total}
      </span>
      <div className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1 || busy}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Oldingi
      </Button>
      <span className="text-label-sm tabular px-2">
        {page} / {lastPage}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= lastPage || busy}
        onClick={() => onPageChange(page + 1)}
      >
        Keyingi
        <ChevronRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
