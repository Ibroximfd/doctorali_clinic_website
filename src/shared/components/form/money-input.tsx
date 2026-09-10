"use client";

import { forwardRef, useEffect, useState } from "react";

import { Input } from "@/shared/components/ui/input";
import { formatMoneyInput, moneyInputValue, parseMoney } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

/**
 * A so'm amount field.
 *
 * Groups the digits as they are typed (`200000` → `200 000`) so reception can
 * read a long amount at a glance instead of counting zeros, and reports the
 * value as a plain integer — the only form the API ever accepts.
 *
 * An edit that would exceed 12 digits is rejected rather than truncated: that
 * is always a typo, and silently dropping a digit changes the number.
 */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  {
    value: number;
    onValueChange: (value: number) => void;
    placeholder?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    autoFocus?: boolean;
  }
>(function MoneyInput({ value, onValueChange, className, ...props }, ref) {
  const [text, setText] = useState(() => moneyInputValue(value));

  // Keep in step when the value is changed from outside (a preset, a clamp).
  useEffect(() => {
    if (parseMoney(text) !== value) setText(moneyInputValue(value));
    // Only react to the incoming value; `text` is this component's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={text}
      onChange={(event) => {
        const next = formatMoneyInput(event.target.value);
        if (next === null) return; // too many digits — keep the old value
        setText(next);
        onValueChange(parseMoney(next));
      }}
      className={cn("tabular", className)}
      {...props}
    />
  );
});
