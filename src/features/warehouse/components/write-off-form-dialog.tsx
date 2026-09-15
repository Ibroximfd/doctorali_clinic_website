"use client";

import { CheckCircle2, Minus, Package, Plus, Save, X } from "lucide-react";
import { useState } from "react";

import {
  formatProductUnits,
  maxSellableQuantity,
  productHasPackaging,
  type Product,
} from "@/features/products/types/product";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
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
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { ApiError } from "@/shared/lib/api/errors";
import { cn } from "@/shared/lib/utils";
import { uuidV4 } from "@/shared/lib/uuid";

import { useConfirmWriteOff, useCreateWriteOff } from "../hooks/use-warehouse";
import {
  WRITE_OFF_REASONS,
  WRITE_OFF_REASON_LABEL,
  reasonRequiresNote,
  writeOffBlocker,
  type StockWriteOffLine,
  type WriteOffReason,
} from "../types/write-off";
import { NumberField } from "./document-line-fields";
import { EmptyDocumentLines, ProductSearchPicker } from "./product-search-picker";

/**
 * One line as it is TYPED: boxes and loose pieces apart, the way an expired
 * shelf is actually counted ("2 karobka + 3 dona"). The ledger only ever sees
 * the base-unit total — see {@link lineUnits}.
 */
interface DraftLine {
  readonly product: Product;
  /** Full packages; always 0 for an unpackaged product. */
  readonly packages: number;
  /** Loose base units on top of the packages. */
  readonly loose: number;
}

function packageSizeOf(product: Product): number {
  return productHasPackaging(product) ? (product.packageSize as number) : 0;
}

function lineUnits(line: DraftLine): number {
  return line.packages * packageSizeOf(line.product) + line.loose;
}

function toWriteOffLines(drafts: readonly DraftLine[]): StockWriteOffLine[] {
  return drafts.map((line) => ({ product: line.product, quantity: lineUnits(line) }));
}

/**
 * Takes stock off the shelf for a reason that is not a sale.
 *
 * A boxed product is written off in BOXES and pieces, with the conversion
 * spelled out under the fields — an expired delivery goes out by the box, and
 * nine on a stepper is exactly the misstep the box exists to avoid. Every line
 * prints what is on the shelf and turns red the moment it asks for more than
 * that: the backend would refuse it as `stock_would_go_negative`, and the form
 * says so first.
 *
 * "Boshqa" demands a note, because a write-off nobody can account for later is
 * exactly what an audit trail exists to prevent. Confirming asks once more —
 * it is the one action here that cannot be undone from this form.
 */
export function WriteOffFormDialog({
  open,
  onOpenChange,
  initialProduct = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A first line already on the form — the stock card's "Chiqim qilish". */
  initialProduct?: Product | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <WriteOffFormBody onOpenChange={onOpenChange} initialProduct={initialProduct} />
      )}
    </Dialog>
  );
}

function WriteOffFormBody({
  onOpenChange,
  initialProduct,
}: {
  onOpenChange: (open: boolean) => void;
  initialProduct: Product | null;
}) {
  const create = useCreateWriteOff();
  const confirm = useConfirmWriteOff();

  const [reason, setReason] = useState<WriteOffReason>("expired");
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<DraftLine[]>(() =>
    initialProduct ? [{ product: initialProduct, packages: 0, loose: 1 }] : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [idempotencyKey] = useState(uuidV4);

  const lines = toWriteOffLines(drafts);
  const blocker = writeOffBlocker({ reason, note, lines });
  const busy = create.isPending || confirm.isPending;
  const noteRequired = reasonRequiresNote(reason);
  const totalUnits = lines.reduce((sum, line) => sum + line.quantity, 0);

  function addProduct(product: Product) {
    setDrafts((current) => [...current, { product, packages: 0, loose: 1 }]);
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setDrafts((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function submit(alsoConfirm: boolean) {
    setError(null);
    try {
      const draft = await create.mutateAsync({ reason, note, lines, idempotencyKey });
      if (alsoConfirm) await confirm.mutateAsync(draft.id);
      onOpenChange(false);
    } catch (caught) {
      setError(describeError(caught));
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>Chiqim qilish</DialogTitle>
        <DialogDescription>
          Tasdiqlangandan keyin bu miqdor qoldiqdan ayiriladi. Qoralama qoldiqqa tegmaydi.
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
          {drafts.length === 0 ? (
            <EmptyDocumentLines message="Chiqim qilinadigan mahsulotni qo'shing." />
          ) : (
            <div className="flex flex-col gap-2">
              {drafts.map((line, index) => (
                <WriteOffLineEditor
                  key={line.product.id}
                  line={line}
                  onChange={(patch) => updateLine(index, patch)}
                  onRemove={() =>
                    setDrafts((current) => current.filter((_, i) => i !== index))
                  }
                />
              ))}
            </div>
          )}
          <ProductSearchPicker
            onSelect={addProduct}
            excludeIds={drafts.map((line) => line.product.id)}
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

        {drafts.length > 0 && (
          <div className="bg-surface-alt flex items-center justify-between rounded-md p-3">
            <span className="text-caption text-text-secondary">
              {drafts.length} ta mahsulot
            </span>
            <span className="text-title tabular">Jami {totalUnits} dona</span>
          </div>
        )}

        {/* The server's refusal outranks the local one: it is the newer fact. */}
        {(error ?? (drafts.length > 0 ? blocker : null)) && (
          <p
            role="alert"
            className="bg-danger/10 text-caption text-danger rounded-md p-3"
          >
            {error ?? blocker}
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
          disabled={blocker !== null || busy}
          onClick={() => void submit(false)}
        >
          <Save className="size-4" aria-hidden />
          Qoralama
        </Button>
        <Button
          type="button"
          className="bg-danger hover:bg-danger/90 text-danger-foreground"
          disabled={blocker !== null || busy}
          onClick={() => setConfirming(true)}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Tasdiqlash
        </Button>
      </DialogFooter>

      {/* One more look before the balance moves — a confirmed write-off is
          reversed only by another document. */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chiqimni tasdiqlash</AlertDialogTitle>
            <AlertDialogDescription>
              {totalUnits} dona mahsulot hisobdan chiqariladi (
              {WRITE_OFF_REASON_LABEL[reason].toLowerCase()}). Qoldiq darhol kamayadi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Orqaga</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-danger-foreground"
              onClick={() => {
                setConfirming(false);
                void submit(true);
              }}
            >
              Chiqim qilish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );
}

/** The two codes this form can cause, worded for the desk; anything else as sent. */
function describeError(error: unknown): string {
  if (!ApiError.is(error)) return "Saqlab bo'lmadi";
  if (error.code === "stock_would_go_negative") {
    return "Omborda yetarli emas — qoldiq bu miqdorni ko'tarmaydi";
  }
  return error.message;
}

/**
 * One product being written off, with the stock it is coming out of.
 *
 * A boxed product gets a box field and a piece field; every product gets a
 * −/+ pair for the odd piece, and a boxed one a "+1 karobka" for the odd box.
 */
function WriteOffLineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: DraftLine;
  onChange: (patch: Partial<DraftLine>) => void;
  onRemove: () => void;
}) {
  const product = line.product;
  const boxed = productHasPackaging(product);
  const size = packageSizeOf(product);
  const units = lineUnits(line);
  const available = maxSellableQuantity(product);
  const over = available !== null && units > available;

  /** One piece less: borrows from a box when the loose count is already 0. */
  function stepDown() {
    if (line.loose > 0) {
      onChange({ loose: line.loose - 1 });
    } else if (line.packages > 0) {
      onChange({ packages: line.packages - 1, loose: size - 1 });
    }
  }

  return (
    <div
      className={cn(
        "rounded-md border p-3",
        over ? "border-danger/50 bg-danger/5" : "border-border",
      )}
    >
      <div className="flex items-center gap-2.5">
        <AppAvatar name={product.name} imageUrl={product.imageUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm truncate">{product.name}</p>
          <p
            className={cn(
              "text-caption tabular truncate",
              over ? "text-danger" : "text-text-tertiary",
            )}
          >
            {available === null
              ? "Qoldiq nazoratsiz"
              : `Omborda: ${formatProductUnits(product, available)}`}
            {available !== null &&
              !over &&
              units > 0 &&
              ` → qoladi ${formatProductUnits(product, available - units)}`}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Qatorni o'chirish"
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        {boxed && (
          <NumberField
            label={product.packageLabel}
            value={line.packages}
            onChange={(packages) => onChange({ packages })}
            className="w-[104px]"
          />
        )}
        <NumberField
          label="dona"
          value={line.loose}
          onChange={(loose) => onChange({ loose })}
          className="w-[104px]"
        />

        <div className="flex items-center gap-1 pb-px">
          <StepButton label="Bir dona kam" disabled={units <= 1} onClick={stepDown}>
            <Minus className="size-4" />
          </StepButton>
          <StepButton
            label="Bir dona ko'p"
            onClick={() => onChange({ loose: line.loose + 1 })}
          >
            <Plus className="size-4" />
          </StepButton>
          {boxed && (
            <button
              type="button"
              onClick={() => onChange({ packages: line.packages + 1 })}
              className={cn(
                "text-label-xs bg-primary-soft text-primary-dark hover:bg-primary-soft/70 inline-flex h-[38px] items-center gap-1 rounded-full px-2.5 font-bold transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <Package className="size-3.5" aria-hidden />
              +1 {product.packageLabel}
            </button>
          )}
        </div>

        {/* The conversion, spelled out where the numbers are typed. */}
        <p className="text-label-sm text-primary-dark tabular ml-auto pb-2.5">
          {boxed
            ? `= ${units} dona (1 ${product.packageLabel} = ${size} dona)`
            : `${units} dona`}
        </p>
      </div>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "border-border bg-surface text-text-secondary hover:bg-surface-hover flex size-[38px] items-center justify-center rounded-sm border transition-colors disabled:opacity-40",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {children}
    </button>
  );
}
