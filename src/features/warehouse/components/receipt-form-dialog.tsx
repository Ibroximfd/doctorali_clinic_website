"use client";

import { CheckCircle2, Save, X } from "lucide-react";
import { useState } from "react";

import {
  formatProductUnits,
  productHasPackaging,
  type Product,
} from "@/features/products/types/product";
import { MoneyInput } from "@/shared/components/form/money-input";
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
import { money } from "@/shared/lib/format/money";
import { uuidV4 } from "@/shared/lib/uuid";

import { useConfirmReceipt, useCreateReceipt } from "../hooks/use-warehouse";
import {
  lineCost,
  lineTotalUnits,
  receiptDraftCost,
  type StockReceiptLine,
} from "../types/receipt";
import { EmptyDocumentLines, ProductSearchPicker } from "./product-search-picker";

/**
 * A goods-in document.
 *
 * A packaged delivery is entered as PACKAGES + LOOSE UNITS, the way the goods
 * physically arrive, with the conversion spelled out under the boxes — that
 * line existing is the whole point: "5 karobka" can never again be typed as
 * "5 dona".
 *
 * Saving leaves a draft, which moves nothing. Only "Tasdiqlash" raises the
 * balances, so the two buttons are deliberately different actions rather than
 * one save that sometimes posts stock.
 */
export function ReceiptFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <ReceiptFormBody onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

function ReceiptFormBody({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const create = useCreateReceipt();
  const confirm = useConfirmReceipt();

  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<StockReceiptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  // One key for this form's whole life, so a retried save cannot double a
  // delivery that actually went through.
  const [idempotencyKey] = useState(uuidV4);

  const totalUnits = lines.reduce((sum, line) => sum + lineTotalUnits(line), 0);
  const totalCost = receiptDraftCost(lines);
  const busy = create.isPending || confirm.isPending;
  const canSave = lines.length > 0 && lines.every((line) => lineTotalUnits(line) > 0);

  function addProduct(product: Product) {
    setLines((current) => [
      ...current,
      { product, quantity: 0, packages: 0, unitCost: 0, packageCost: 0 },
    ]);
  }

  function updateLine(index: number, patch: Partial<StockReceiptLine>) {
    setLines((current) =>
      current.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  async function saveDraft() {
    setError(null);
    return create.mutateAsync({ lines, supplier, note, idempotencyKey });
  }

  async function onSaveDraft() {
    try {
      await saveDraft();
      onOpenChange(false);
    } catch (caught) {
      setError(ApiError.is(caught) ? caught.message : "Saqlab bo'lmadi");
    }
  }

  async function onConfirm() {
    try {
      // The document has to exist server-side before it can be confirmed, so a
      // never-saved form is saved first — invisible to the user, who only asked
      // to confirm.
      const draft = await saveDraft();
      await confirm.mutateAsync(draft.id);
      onOpenChange(false);
    } catch (caught) {
      setError(ApiError.is(caught) ? caught.message : "Tasdiqlab bo'lmadi");
    }
  }

  return (
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[680px]">
      <DialogHeader>
        <DialogTitle>Yangi kirim</DialogTitle>
        <DialogDescription>
          Qoralama qoldiqqa tegmaydi — mahsulot faqat tasdiqlanganda kirim bo&rsquo;ladi.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="receipt-supplier">Yetkazib beruvchi</Label>
          <Input
            id="receipt-supplier"
            value={supplier}
            onChange={(event) => setSupplier(event.target.value)}
            placeholder="Masalan: Mehrigiyo bazasi"
            className="h-[42px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Mahsulotlar</Label>
          {lines.length === 0 ? (
            <EmptyDocumentLines message="Kirim qilinadigan mahsulotni qo'shing." />
          ) : (
            <div className="flex flex-col gap-2">
              {lines.map((line, index) => (
                <ReceiptLineEditor
                  key={line.product.id}
                  line={line}
                  onChange={(patch) => updateLine(index, patch)}
                  onRemove={() =>
                    setLines((current) => current.filter((_, i) => i !== index))
                  }
                />
              ))}
            </div>
          )}
          <ProductSearchPicker
            onSelect={addProduct}
            excludeIds={lines.map((line) => line.product.id)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receipt-note">Izoh</Label>
          <Textarea
            id="receipt-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ixtiyoriy"
          />
        </div>

        {lines.length > 0 && (
          <div className="bg-surface-alt flex items-center justify-between rounded-md p-3">
            <span className="text-caption text-text-secondary">
              Jami <span className="tabular">{totalUnits}</span> dona
            </span>
            <span className="text-title tabular">{money.uzs(totalCost)}</span>
          </div>
        )}

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
          disabled={!canSave || busy}
          onClick={() => void onSaveDraft()}
        >
          <Save className="size-4" aria-hidden />
          Qoralama
        </Button>
        <Button
          type="button"
          disabled={!canSave || busy}
          onClick={() => void onConfirm()}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Tasdiqlash
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReceiptLineEditor({
  line,
  onChange,
  onRemove,
}: {
  line: StockReceiptLine;
  onChange: (patch: Partial<StockReceiptLine>) => void;
  onRemove: () => void;
}) {
  const product = line.product;
  const boxed = productHasPackaging(product);
  const units = lineTotalUnits(line);

  return (
    <div className="border-border rounded-md border p-3">
      <div className="flex items-center gap-2.5">
        <AppAvatar name={product.name} imageUrl={product.imageUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm truncate">{product.name}</p>
          <p className="text-caption text-text-tertiary tabular truncate">
            Hozir: {formatProductUnits(product, product.stockQuantity)}
            {units > 0 &&
              ` → ${formatProductUnits(product, product.stockQuantity + units)}`}
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

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {boxed && (
          <NumberField
            label={product.packageLabel}
            value={line.packages}
            onChange={(packages) => onChange({ packages })}
          />
        )}
        <NumberField
          label="dona"
          value={line.quantity}
          onChange={(quantity) => onChange({ quantity })}
        />
        {boxed && (
          <div className="space-y-1">
            <span className="text-label-xs text-text-tertiary">
              1 {product.packageLabel} narxi
            </span>
            <MoneyInput
              value={line.packageCost}
              onValueChange={(packageCost) => onChange({ packageCost })}
              className="h-[38px]"
            />
          </div>
        )}
        <div className="space-y-1">
          <span className="text-label-xs text-text-tertiary">1 dona narxi</span>
          <MoneyInput
            value={line.unitCost}
            onValueChange={(unitCost) => onChange({ unitCost })}
            className="h-[38px]"
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
        {/* The conversion, spelled out where the numbers are typed. */}
        {boxed && (
          <p className="text-label-sm text-primary-dark tabular">
            = {units} dona (1 {product.packageLabel} = {product.packageSize} dona)
          </p>
        )}
        <p className="text-label-sm text-text-secondary tabular ml-auto">
          {money.plain(lineCost(line))}
        </p>
      </div>

      {/* Zero means "keep the existing cost": the backend leaves the weighted
          average alone rather than averaging a zero into it. */}
      {line.unitCost === 0 && line.packageCost === 0 && (
        <p className="text-caption text-text-tertiary mt-1">
          Narx kiritilmadi — mavjud tannarx o&rsquo;zgarmaydi.
        </p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
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
