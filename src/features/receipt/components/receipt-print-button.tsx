"use client";

import { Printer } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

import { usePrintedOrders, useReceiptPrint } from "../hooks/use-receipt-print";

/**
 * Reprints an order's receipt.
 *
 * A **red** icon means no receipt has been sent to the printer for this order
 * on this device yet — the one thing the desk needs to spot while scanning a
 * list of today's sales.
 */
export function ReceiptPrintButton({
  orderId,
  size = "icon",
  className,
}: {
  orderId: string;
  size?: "icon" | "sm";
  className?: string;
}) {
  const { print, isPrinting, printingId } = useReceiptPrint();
  const printed = usePrintedOrders();

  const busy = isPrinting && printingId === orderId;
  const everPrinted = printed.has(orderId);
  const label = everPrinted ? "Chekni qayta chiqarish" : "Chek hali chiqarilmagan";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={size}
          disabled={busy}
          onClick={(event) => {
            // The button lives INSIDE a clickable row: without this, printing a
            // receipt also opened the order's dialog on top of the list — a
            // modal nobody asked for, over the list they were scanning.
            event.stopPropagation();
            print(orderId);
          }}
          aria-label={label}
          className={cn(everPrinted ? "text-text-secondary" : "text-danger", className)}
        >
          {busy ? (
            <span
              className="size-4 animate-spin rounded-full border-2 border-current/40 border-t-current"
              aria-hidden
            />
          ) : (
            <Printer className="size-[18px]" />
          )}
          {size === "sm" && <span>Chek</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
