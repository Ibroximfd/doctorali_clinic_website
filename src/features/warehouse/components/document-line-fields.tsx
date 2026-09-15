"use client";

import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

/**
 * A whole-number field on a document line ("karobka", "dona"). Blank reads as
 * zero, so a cleared box never becomes NaN on the wire.
 */
export function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="text-label-xs text-text-tertiary">{label}</span>
      <Input
        inputMode="numeric"
        value={value === 0 ? "" : String(value)}
        placeholder="0"
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          onChange(digits === "" ? 0 : Number(digits));
        }}
        className="tabular h-[38px]"
        aria-label={label}
      />
    </div>
  );
}
