"use client";

import { KeyRound, ShieldAlert } from "lucide-react";
import { useRef, useState } from "react";

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
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";

import { verifyPin } from "../api/confirm-pin-api";

const PIN_LENGTH = 4;

/**
 * The gate on any change to a record that isn't today's — a backdated order, an
 * edit, a delete, re-closing a day.
 *
 * The PIN is verified here AND sent again on the write itself as
 * `X-Confirm-Pin`, so the server re-checks it rather than trusting this dialog.
 * That is why the verified PIN is handed back to the caller instead of being
 * discarded once the dialog closes.
 */
export function PinConfirmDialog({
  open,
  onOpenChange,
  onConfirmed,
  title = "Tasdiqlash talab qilinadi",
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the verified PIN, to be forwarded as `X-Confirm-Pin`. */
  onConfirmed: (pin: string) => void;
  title?: string;
  description?: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useResetOnChange(open, () => {
    if (!open) return;
    setPin("");
    setError(null);
    setChecking(false);
  });

  async function submit() {
    if (pin.length !== PIN_LENGTH || checking) return;
    setChecking(true);
    setError(null);

    const result = await verifyPin(pin);
    setChecking(false);

    if (result.ok) {
      onConfirmed(pin);
      onOpenChange(false);
      return;
    }
    setError(result.kind === "invalid" ? "PIN-kod noto'g'ri" : result.message);
    setPin("");
    inputRef.current?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="bg-warning/15 mb-1 flex size-11 items-center justify-center rounded-md">
            <ShieldAlert className="text-warning size-5" aria-hidden />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              "Bugungi kundan boshqa yozuvni o'zgartirish uchun 4 xonali PIN-kodni kiriting."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="confirm-pin">PIN-kod</Label>
          <Input
            id="confirm-pin"
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={PIN_LENGTH}
            value={pin}
            aria-invalid={error !== null}
            aria-describedby={error ? "confirm-pin-error" : undefined}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH));
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            className="tabular h-[56px] text-center text-2xl font-bold tracking-[0.6em]"
          />
          {error && (
            <p id="confirm-pin-error" role="alert" className="text-caption text-danger">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={pin.length !== PIN_LENGTH || checking}>
            {checking ? (
              <span
                className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                aria-hidden
              />
            ) : (
              <KeyRound className="size-4" aria-hidden />
            )}
            Tasdiqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
