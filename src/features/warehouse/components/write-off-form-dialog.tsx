"use client";

import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";

import { formatProductUnits, type Product } from "@/features/products/types/product";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { ApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/utils";
import { uuidV4 } from "@/shared/lib/uuid";

import { useConfirmWriteOff, useCreateWriteOff } from "../hooks/use-warehouse";
import {
  WRITE_OFF_REASONS,
  WRITE_OFF_REASON_LABEL,
  isWriteOffValid,
  reasonRequiresNote,
  type StockWriteOffLine,
  type WriteOffReason,
} from "../types/write-off";
import { EmptyDocumentLines, ProductSearchPicker } from "./product-search-picker";

/**
 * Takes stock off the shelf for a reason that is not a sale.
 *
 * "Boshqa" demands a note, because a write-off nobody can account for later is
 * exactly what an audit trail exists to prevent — the backend enforces it too,
 * and the form says so before the request rather than after it.
 */
export function WriteOffFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <WriteOffFormBody onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function WriteOffFormBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const create = useCreateWriteOff();
  const confirm = useConfirmWriteOff();

  const [reason, setReason] = useState<WriteOffReason>("expired");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockWriteOffLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(uuidV4);

  const valid = isWriteOffValid({ reason, note, lines });
  const busy = create.isPending || confirm.isPending;
  const noteRequired = reasonRequiresNote(reason);

  function addProduct(product: Product) {
    setLines((current) => [...current, { product, quantity: 1 }]);
  }

  async function submit(alsoConfirm: boolean) {
    setError(null);
    try {
      const draft = await create.mutateAsync({
        reason,
        note,
        lines,
        idempotencyKey,
      });
      if (alsoConfirm) await confirm.mutateAsync(draft.id);
      onOpenChange(false);
    } catch (caught) {
      setError(ApiError.is(caught) ? caught.message : "Saqlab bo'lmadi");
    }
  }

  return (
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle>Chiqim qilish</DialogTitle>
        <DialogDescription>
          Tasdiqlangandan keyin bu miqdor qoldiqdan ayiriladi.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label>Sabab</Label>
          <div role="radiogroup" aria-label="Sabab" className="flex flex-wrap gap-1.5">
            {WRITE_OFF_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={reason === option}
                onClick={() => setReason(option)}
                className={cn(
                  "text-label-sm rounded-full border px-3 py-1.5 transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  reason === option
                    ? "border-primary bg-primary-soft text-primary-dark"
                    : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                )}
              >
                {WRITE_OFF_REASON_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mahsulotlar</Label>
          {lines.length === 0 ? (
            <EmptyDocumentLines message="Chiqim qilinadigan mahsulotni qo'shing." />
          ) : (
            <div className="flex flex-col gap-2">
              {lines.map((line, index) => (
                <div
                  key={line.product.id}
                  className="border-border flex items-center gap-2.5 rounded-md border p-2.5"
                >
                  <AppAvatar
                    name={line.product.name}
                    imageUrl={line.product.imageUrl}
                    size={30}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-title-sm truncate">{line.product.name}</p>
                    <p className="text-caption text-text-tertiary tabular truncate">
                      Qoldiq:{" "}
                      {formatProductUnits(line.product, line.product.stockQuantity)}
                    </p>
                  </div>
                  <Input
                    inputMode="numeric"
                    aria-label={`${line.product.name} miqdori`}
                    value={line.quantity === 0 ? "" : String(line.quantity)}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "");
                      const quantity = digits === "" ? 0 : Number(digits);
                      setLines((current) =>
                        current.map((l, i) => (i === index ? { ...l, quantity } : l)),
                      );
                    }}
                    className="tabular h-[38px] w-[90px]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Qatorni o'chirish"
                    onClick={() =>
                      setLines((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <ProductSearchPicker
            onSelect={addProduct}
            excludeIds={lines.map((line) => line.product.id)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="write-off-note">Izoh{noteRequired && " *"}</Label>
          <Textarea
            id="write-off-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={
              noteRequired ? "«Boshqa» sababi uchun izoh majburiy" : "Ixtiyoriy"
            }
            aria-invalid={noteRequired && note.trim() === ""}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="bg-danger/10 text-caption text-danger rounded-md p-3"
          >
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Bekor qilish
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!valid || busy}
          onClick={() => void submit(false)}
        >
          Qoralama
        </Button>
        <Button
          type="button"
          className="bg-danger hover:bg-danger/90 text-danger-foreground"
          disabled={!valid || busy}
          onClick={() => void submit(true)}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Tasdiqlash
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
