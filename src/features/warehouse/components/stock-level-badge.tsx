import { CheckCircle2, MinusCircle, TriangleAlert } from "lucide-react";

import { cn } from "@/shared/lib/utils";

/**
 * Stock state as one glanceable badge: enough / running low / none left.
 *
 * An untracked product shows nothing at all — "unlimited" is not a warning.
 */
export function StockLevelBadge({
  quantity,
  minQuantity,
  trackStock = true,
  showUnits = true,
  unitsText,
  className,
}: {
  quantity: number;
  minQuantity: number;
  trackStock?: boolean;
  /** Show "14 dona" rather than just the status word. */
  showUnits?: boolean;
  /** Preformatted quantity ("1 karobka + 5 dona") for a packaged product. */
  unitsText?: string;
  className?: string;
}) {
  if (!trackStock) return null;

  const isOut = quantity <= 0;
  const isLow = quantity > 0 && quantity <= minQuantity;

  const { tone, Icon, label } = isOut
    ? {
        tone: "border-danger/30 bg-danger/12 text-danger",
        Icon: MinusCircle,
        label: "Tugagan",
      }
    : isLow
      ? {
          tone: "border-warning/30 bg-warning/12 text-warning",
          Icon: TriangleAlert,
          label: "Kam qoldi",
        }
      : {
          tone: "border-success/30 bg-success/12 text-success",
          Icon: CheckCircle2,
          label: "Yetarli",
        };

  return (
    <span
      className={cn(
        "text-label-xs inline-flex items-center gap-1 rounded-full border px-2 py-0.5 whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {showUnits && !isOut ? (unitsText ?? `${quantity} dona`) : label}
    </span>
  );
}
