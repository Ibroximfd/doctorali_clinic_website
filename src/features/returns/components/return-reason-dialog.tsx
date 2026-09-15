"use client";

import { useState } from "react";

import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";

import { useUpdateReturnReason } from "../hooks/use-returns";
import type { OrderReturn } from "../types/order-return";

const REASON_MAX = 255;

/**
 * Corrects the reason on a return — the ONLY editable part of one.
 *
 * Quantities and sums are immutable because changing them would mean moving
 * stock and money a second time; a wrong return is corrected by filing another.
 * The edit is written to the audit log, which is why it is allowed at all: a
 * cash payout whose stated reason can be swapped silently is worse than a typo.
 */
export function ReturnReasonDialog({
  target,
  open,
  onOpenChange,
}: {
  target: OrderReturn | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open && target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        {target && (
          <ReasonBody
            key={target.id}
            target={target}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReasonBody({ target, onClose }: { target: OrderReturn; onClose: () => void }) {
  const save = useUpdateReturnReason();
  const [reason, setReason] = useState(target.reason);
  const unchanged = reason.trim() === target.reason.trim();

  /**
   * Closes only when the server accepted it. A refusal is already on screen as
   * a toast, and the typed text stays where it is so it can be retried — which
   * an `await` in the handler alone would not give us, since its rejection
   * would go nowhere.
   */
  function submit() {
    save.mutate({ id: target.id, reason }, { onSuccess: onClose });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Sababni tahrirlash</DialogTitle>
        <DialogDescription className="tabular">
          {target.orderNumber} · o&rsquo;zgarish auditga yoziladi
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="return-reason-edit">Sabab</Label>
        <Textarea
          id="return-reason-edit"
          rows={3}
          maxLength={REASON_MAX}
          value={reason}
          autoFocus
          onChange={(event) => setReason(event.target.value)}
          placeholder="Sababni yozing…"
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button type="button" disabled={unchanged || save.isPending} onClick={submit}>
          Saqlash
        </Button>
      </DialogFooter>
    </>
  );
}
