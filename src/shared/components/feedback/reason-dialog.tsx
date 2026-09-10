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
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";

/**
 * Asks for the reason behind a destructive action.
 *
 * Every cancel and delete in this panel is audited, and the reason is what the
 * audit log and the client's history feed will show — so it is a real field
 * with a label, not a `window.prompt`.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Tasdiqlash",
  placeholder = "Sababni yozing…",
  destructive = true,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  placeholder?: string;
  destructive?: boolean;
  busy?: boolean;
}) {
  const [reason, setReason] = useState("");

  useResetOnChange(open, () => {
    if (open) setReason("");
  });

  const empty = reason.trim() === "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Sabab</Label>
          <Textarea
            id="reason"
            autoFocus
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={placeholder}
            aria-invalid={empty}
          />
          <p className="text-caption text-text-tertiary">
            Sabab audit jurnaliga yoziladi.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={empty || busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {busy && (
              <span
                className="size-4 animate-spin rounded-full border-2 border-current/40 border-t-current"
                aria-hidden
              />
            )}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
