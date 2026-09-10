"use client";

import { forwardRef } from "react";

import { Input } from "@/shared/components/ui/input";
import { formatPhoneInput } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

/**
 * An Uzbek phone field, masked as `+998 (90) 123-45-67`.
 *
 * The masked text is what the caller holds; convert it with `phoneToApi()` at
 * the request boundary. Keeping the mask in state (rather than raw digits) is
 * what lets the caret behave normally while typing.
 */
export const PhoneInput = forwardRef<
  HTMLInputElement,
  {
    value: string;
    onValueChange: (masked: string) => void;
    id?: string;
    className?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }
>(function PhoneInput({ value, onValueChange, className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+998 (__) ___-__-__"
      value={value}
      onChange={(event) => onValueChange(formatPhoneInput(event.target.value))}
      onFocus={(event) => {
        // Land the caret at the end rather than inside the "+998 " prefix.
        const input = event.currentTarget;
        requestAnimationFrame(() => {
          input.setSelectionRange(input.value.length, input.value.length);
        });
      }}
      className={cn("tabular", className)}
      {...props}
    />
  );
});
