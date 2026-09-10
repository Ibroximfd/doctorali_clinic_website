import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * A KPI tile: label, a quiet tinted icon chip on the trailing edge, and the
 * figure. The number is the point of the tile, so it gets the space — the icon
 * is deliberately small and low-contrast.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  className,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: "primary" | "info" | "warning" | "danger" | "gold" | "neutral";
  /** A second line under the figure — a comparison, a breakdown. */
  hint?: string;
  className?: string;
}) {
  const tones: Record<string, { chip: string; icon: string; value?: string }> = {
    primary: { chip: "bg-primary/12", icon: "text-primary" },
    info: { chip: "bg-info/12", icon: "text-info" },
    warning: {
      chip: "bg-warning/14",
      icon: "text-warning",
      value: "text-warning",
    },
    danger: {
      chip: "bg-danger/12",
      icon: "text-danger",
      value: "text-danger",
    },
    gold: { chip: "bg-gold/14", icon: "text-gold" },
    neutral: { chip: "bg-surface-alt", icon: "text-text-tertiary" },
  };
  const t = tones[tone];

  return (
    <div
      className={cn(
        "border-border bg-surface rounded-lg border p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-label-sm text-text-secondary min-w-0 flex-1 truncate">
          {label}
        </span>
        <span
          className={cn(
            "flex size-[34px] items-center justify-center rounded-sm",
            t.chip,
          )}
          aria-hidden
        >
          <Icon className={cn("size-[18px]", t.icon)} />
        </span>
      </div>
      <p className={cn("text-headline tabular mt-3", t.value)}>{value}</p>
      {hint && <p className="text-caption text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}
