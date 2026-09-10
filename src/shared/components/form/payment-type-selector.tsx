"use client";

import {
  NO_PAYMENT_ICON,
  NO_PAYMENT_LABEL,
  PAYMENT_TYPES,
  PAYMENT_TYPE_ICON,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { cn } from "@/shared/lib/utils";

/**
 * How the client paid.
 *
 * The interesting case is `nothingPayable`: when the whole sum went on credit
 * or the order is a 0-so'm gift, the till takes nothing and the sale is booked
 * `payment_type: "none"`. The chips stay on screen and stay selectable there —
 * reception may still want a free hand-out recorded as cash, or a fully
 * credited sale marked as card — but nothing is required, and "To'lanmagan" is
 * what it reads as until they choose.
 */
export function PaymentTypeSelector({
  value,
  onChange,
  nothingPayable = false,
  marked = true,
  onUnmark,
  error,
  className,
}: {
  value: PaymentType | null;
  onChange: (type: PaymentType) => void;
  /** True when the till takes nothing on this sale. */
  nothingPayable?: boolean;
  /** False while the desk has deliberately left it as "To'lanmagan". */
  marked?: boolean;
  onUnmark?: () => void;
  error?: string | null;
  className?: string;
}) {
  const showingNone = nothingPayable && !marked;
  const NoneIcon = NO_PAYMENT_ICON;

  return (
    <div className={cn("space-y-2", className)}>
      <div role="radiogroup" aria-label="To'lov turi" className="flex gap-2">
        {PAYMENT_TYPES.map((type) => {
          const Icon = PAYMENT_TYPE_ICON[type];
          const selected = !showingNone && value === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(type)}
              className={cn(
                "text-label flex h-[46px] flex-1 items-center justify-center gap-2 rounded-md border",
                "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary-soft text-primary-dark"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {PAYMENT_TYPE_LABEL[type]}
            </button>
          );
        })}
      </div>

      {nothingPayable && (
        <button
          type="button"
          onClick={onUnmark}
          aria-pressed={showingNone}
          className={cn(
            "text-label-sm flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2",
            "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
            showingNone
              ? "border-warning bg-warning/12 text-warning"
              : "border-border bg-surface text-text-tertiary hover:bg-surface-hover",
          )}
        >
          <NoneIcon className="size-4" aria-hidden />
          {NO_PAYMENT_LABEL}
          <span className="text-caption font-normal">— kassaga hech narsa tushmaydi</span>
        </button>
      )}

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
