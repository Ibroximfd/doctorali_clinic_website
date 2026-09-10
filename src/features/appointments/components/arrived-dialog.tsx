"use client";

import { CheckCircle2, Link2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { useOrdersQuery } from "@/features/orders/hooks/use-orders";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import type { Appointment } from "../types/appointment";

/**
 * Marks a client as arrived, with an optional link to the sale they came for.
 *
 * The link is genuinely optional and the skip button says so: the important
 * half of this action is the status change, and holding it hostage to finding
 * an order would leave the queue wrong while reception hunts for a number.
 */
export function ArrivedDialog({
  appointment,
  open,
  onOpenChange,
  onConfirm,
}: {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (orderId: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {appointment && (
        // Keyed by the visit, so the search and the typed id start clean for
        // each client instead of being cleared by an effect after the fact.
        <ArrivedDialogBody
          key={appointment.id}
          appointment={appointment}
          onOpenChange={onOpenChange}
          onConfirm={onConfirm}
        />
      )}
    </Dialog>
  );
}

function ArrivedDialogBody({
  appointment,
  onOpenChange,
  onConfirm,
}: {
  appointment: Appointment;
  onOpenChange: (open: boolean) => void;
  onConfirm: (orderId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [manualId, setManualId] = useState("");

  // Default the search to this client's own phone, which is what reception
  // would type anyway: their recent orders are the candidates.
  const query = useDebouncedValue(search.trim() || appointment.clientPhone);
  const filter = useMemo(() => ({ search: query, ordering: "-created_at" }), [query]);
  const { data, isPending } = useOrdersQuery(filter, 1);

  function confirm(orderId: string | null) {
    onConfirm(orderId);
    onOpenChange(false);
  }

  const orders = data?.results.slice(0, 6) ?? [];

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>Mijoz keldi</DialogTitle>
        <DialogDescription className="tabular">
          {appointment.clientName} · {phoneFromApi(appointment.clientPhone)}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="arrived-search">
            Buyurtma bilan bog&rsquo;lash (ixtiyoriy)
          </Label>
          <div className="relative">
            <Search
              className="text-text-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="arrived-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buyurtma raqami yoki mijoz…"
              className="h-[42px] pl-9"
            />
          </div>
        </div>

        <div className="border-border max-h-[240px] overflow-y-auto rounded-md border">
          {isPending ? (
            <div className="flex flex-col gap-px p-1" aria-hidden>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-sm" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <p className="text-caption text-text-tertiary px-3 py-6 text-center">
              Buyurtma topilmadi — bog&rsquo;lamasdan davom eting
            </p>
          ) : (
            <ul className="p-1">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => confirm(order.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left transition-colors",
                      "hover:bg-surface-hover focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-title-sm tabular block truncate">
                        {order.orderNumber}
                      </span>
                      <span className="text-caption text-text-tertiary block truncate">
                        {order.clientName} · {shortDateTime(order.createdAt)}
                      </span>
                    </span>
                    <span className="text-label text-primary tabular shrink-0">
                      {money.plain(order.totalAmount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="arrived-manual">Buyurtma ID (qo&rsquo;lda)</Label>
          <div className="flex gap-2">
            <Input
              id="arrived-manual"
              value={manualId}
              onChange={(event) => setManualId(event.target.value)}
              placeholder="ID"
              className="tabular h-[42px] flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="h-[42px]"
              disabled={manualId.trim() === ""}
              onClick={() => confirm(manualId.trim())}
            >
              <Link2 className="size-4" aria-hidden />
              Bog&rsquo;lash
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Bekor qilish
        </Button>
        {/* Linking is optional, so the primary action skips it — the status
              change is the half that matters, and it must not wait on a hunt
              for an order number. */}
        <Button type="button" onClick={() => confirm(null)}>
          <CheckCircle2 className="size-4" aria-hidden />
          Bog&rsquo;lamasdan belgilash
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
