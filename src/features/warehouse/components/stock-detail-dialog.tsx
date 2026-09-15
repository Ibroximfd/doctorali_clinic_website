"use client";

import { ArrowRight, History, MinusCircle, PackagePlus, Save } from "lucide-react";
import { useState } from "react";

import { formatProductUnits, type Product } from "@/features/products/types/product";
import { MoneyInput } from "@/shared/components/form/money-input";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import { ApiError } from "@/shared/lib/api/errors";
import { shortDate } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

import type { PackagingUpdate } from "../api/warehouse-api";
import {
  useStockItemQuery,
  useUpdatePackaging,
  useUpdateStockSettings,
} from "../hooks/use-warehouse";
import type { StockItem } from "../types/stock";
import { MovementRow } from "./movements-list";
import { StockLevelBadge } from "./stock-level-badge";

/** How many ledger rows the card shows before pointing at the full history. */
const RECENT_MOVEMENTS = 20;

/** What the card can start for its product — wired by the page that owns the documents. */
export interface StockDetailActions {
  /** Opens a goods-in document with this product already on it. */
  readonly onReceive: (product: Product) => void;
  /** Opens a write-off with this product already on it. */
  readonly onWriteOff: (product: Product) => void;
  /** Shows the full ledger narrowed to this product. */
  readonly onShowMovements: (product: Product) => void;
}

/**
 * One product's stock card: balance, cost, recent movements — and the answer
 * to the only question that matters, "how long will this last?".
 *
 * There is deliberately no quantity field: a balance changes only through a
 * confirmed document, which is why the card offers "Kirim qilish" and "Chiqim
 * qilish" instead. What CAN be edited here are settings — the low-stock
 * threshold, whether the product is tracked at all, and how it is boxed and
 * priced.
 */
export function StockDetailDialog({
  item,
  open,
  onOpenChange,
  actions,
}: {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: StockDetailActions;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && item && (
        <DetailBody
          key={item.product.id}
          item={item}
          onOpenChange={onOpenChange}
          actions={actions}
        />
      )}
    </Dialog>
  );
}

function DetailBody({
  item,
  onOpenChange,
  actions,
}: {
  item: StockItem;
  onOpenChange: (open: boolean) => void;
  actions: StockDetailActions;
}) {
  const detail = useStockItemQuery(item.product.id);
  const saveSettings = useUpdateStockSettings();
  const savePackaging = useUpdatePackaging();

  // The form diffs against the product AS THE CARD OPENED; the header shows
  // the card's fresh figures, because a delivery confirmed from here changes
  // the balance while the dialog is still up.
  const product = item.product;
  const current = detail.data?.item ?? item;
  const card = detail.data;

  const [minQuantity, setMinQuantity] = useState(item.minQuantity);
  const [trackStock, setTrackStock] = useState(item.trackStock);
  const [packageSize, setPackageSize] = useState<number | null>(product.packageSize);
  const [packageLabel, setPackageLabel] = useState(product.packageLabel);
  const [packagePrice, setPackagePrice] = useState<number | null>(product.packagePrice);
  const [unitSaleEnabled, setUnitSaleEnabled] = useState(product.unitSaleEnabled);
  /*
   * The piece price (`unit_price`) — what the catalog reports back as `price`.
   * Sent ONLY when reception touched it: sending the key at all switches the
   * product into "the catalog price is the box price" mode, so re-sending an
   * unchanged piece price would change how the product sells behind the
   * desk's back.
   */
  const [unitPrice, setUnitPrice] = useState(product.priceUzs);
  const unitTouched = unitPrice !== product.priceUzs;
  const [error, setError] = useState<string | null>(null);

  const busy = saveSettings.isPending || savePackaging.isPending;
  const boxLabel = packageLabel.trim() || "Karobka";

  /**
   * What a piece will actually cost after this save is the figure the box
   * price has to beat. A box at or below one piece would sell nine for the
   * price of one; the server answers `packaging_price_conflict`, and saying so
   * here saves the round trip.
   */
  function validate(): string | null {
    if (packageSize !== null && packageSize < 2) {
      return "Qadoqdagi dona soni kamida 2 bo'lishi kerak";
    }
    const effectiveUnit = unitTouched && unitPrice > 0 ? unitPrice : product.priceUzs;
    if (
      packageSize !== null &&
      packagePrice !== null &&
      effectiveUnit > 0 &&
      packagePrice <= effectiveUnit
    ) {
      return `${boxLabel} narxi dona narxidan katta bo'lishi kerak (${money.uzs(effectiveUnit)})`;
    }
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    try {
      if (minQuantity !== item.minQuantity || trackStock !== item.trackStock) {
        await saveSettings.mutateAsync({
          productId: product.id,
          changes: {
            ...(minQuantity !== item.minQuantity ? { minQuantity } : {}),
            ...(trackStock !== item.trackStock ? { trackStock } : {}),
          },
        });
      }

      // Only what was actually touched is sent — each key is tri-state on the
      // wire (absent / value / null), and an untouched key must stay absent.
      const turnedOff = packageSize === null && product.packageSize !== null;
      const packaging: PackagingUpdate = {
        ...(turnedOff
          ? { clearPackageSize: true }
          : packageSize !== null && packageSize !== product.packageSize
            ? { packageSize }
            : {}),
        // Switching packaging off clears the box price with it — a box price
        // without a box is a contradiction the server would carry forever.
        ...(turnedOff
          ? product.packagePrice !== null
            ? { clearPackagePrice: true }
            : {}
          : packagePrice === null && product.packagePrice !== null
            ? { clearPackagePrice: true }
            : packagePrice !== null && packagePrice !== product.packagePrice
              ? { packagePrice }
              : {}),
        ...(unitTouched
          ? unitPrice > 0
            ? { unitPrice }
            : { clearUnitPrice: true }
          : {}),
        ...(unitSaleEnabled !== product.unitSaleEnabled ? { unitSaleEnabled } : {}),
        ...(packageLabel !== product.packageLabel ? { packageLabel } : {}),
      };

      if (Object.keys(packaging).length > 0) {
        await savePackaging.mutateAsync({ productId: product.id, changes: packaging });
      }
      onOpenChange(false);
    } catch (caught) {
      setError(describeSaveError(caught, boxLabel));
    }
  }

  const movements = card?.movements.slice(0, RECENT_MOVEMENTS) ?? [];

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[680px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <AppAvatar name={product.name} imageUrl={product.imageUrl} size={34} />
          <span className="min-w-0 truncate">{product.name}</span>
        </DialogTitle>
        <DialogDescription>
          Qoldiq faqat hujjat orqali o&rsquo;zgaradi — bu yerda sozlamalar tahrirlanadi,
          kirim va chiqim pastdagi tugmalardan ochiladi.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="bg-surface-alt flex flex-wrap items-center gap-2 rounded-md p-3">
          <StockLevelBadge
            quantity={current.quantity}
            minQuantity={current.minQuantity}
            trackStock={current.trackStock}
            unitsText={formatProductUnits(current.product, current.quantity)}
          />
          <span className="text-caption text-text-secondary tabular">
            Tannarx {money.plain(current.costPrice)} · Qiymati{" "}
            {money.plain(current.stockValue)}
          </span>
          {current.lastReceiptAt && (
            <span className="text-caption text-text-tertiary tabular">
              Oxirgi kirim {shortDate(current.lastReceiptAt)}
            </span>
          )}
        </div>

        {card && (
          <div className="grid grid-cols-3 gap-2">
            {/* In boxes too for a packaged product — "6 karobka + 3 dona" is
                what the next order is decided on. */}
            <Figure
              label="30 kunda sotildi"
              value={formatProductUnits(current.product, card.sold30d)}
            />
            <Figure label="Kunlik o'rtacha" value={card.avgDailySales.toFixed(1)} />
            {/* Null rather than "forever": nothing has sold, so the cover is
                unknown, which is a different answer. */}
            <Figure
              label="Yetadi"
              value={
                card.daysOfStock === null ? "—" : `${Math.round(card.daysOfStock)} kun`
              }
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stock-min">Minimal qoldiq</Label>
            <Input
              id="stock-min"
              inputMode="numeric"
              value={String(minQuantity)}
              onChange={(event) =>
                setMinQuantity(Number(event.target.value.replace(/\D/g, "") || 0))
              }
              className="tabular h-[42px]"
            />
            <p className="text-caption text-text-tertiary">
              Shu chegaradan pastda ogohlantiradi
            </p>
          </div>
          <div className="border-border flex items-center justify-between rounded-md border p-3">
            <span>
              <span className="text-label block">Qoldiq nazorati</span>
              <span className="text-caption text-text-tertiary block">
                {trackStock
                  ? "Qoldiq yuritiladi, tugaganda sotuv bloklanadi"
                  : "Nazoratsiz — qoldiq yuritilmaydi, sotuv cheklanmaydi"}
              </span>
            </span>
            <Switch
              checked={trackStock}
              onCheckedChange={setTrackStock}
              aria-label="Qoldiq nazorati"
            />
          </div>
        </div>

        <div className="border-border space-y-2 rounded-md border p-3">
          <p className="text-label">Narx va qadoqlash</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-label-xs text-text-tertiary">1 dona narxi</span>
              <MoneyInput
                value={unitPrice}
                onValueChange={setUnitPrice}
                aria-label="1 dona narxi"
                className="h-[38px]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-label-xs text-text-tertiary">Qadoq narxi</span>
              <MoneyInput
                value={packagePrice ?? 0}
                onValueChange={(value) => setPackagePrice(value === 0 ? null : value)}
                aria-label="Qadoq narxi"
                className="h-[38px]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-label-xs text-text-tertiary">1 qadoqda (dona)</span>
              <Input
                inputMode="numeric"
                placeholder="—"
                aria-label="Qadoqdagi dona"
                value={packageSize === null ? "" : String(packageSize)}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  setPackageSize(digits === "" ? null : Number(digits));
                }}
                className="tabular h-[38px]"
              />
            </div>
            <div className="space-y-1">
              <span className="text-label-xs text-text-tertiary">Qadoq nomi</span>
              <Input
                value={packageLabel}
                aria-label="Qadoq nomi"
                onChange={(event) => setPackageLabel(event.target.value)}
                className="h-[38px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-caption text-text-secondary">
              Donalab sotishga ruxsat
              <span className="text-text-tertiary block">
                {unitSaleEnabled
                  ? "Qadoq ochib donalab sotish mumkin"
                  : `Faqat butun ${boxLabel.toLowerCase()}da sotiladi`}
              </span>
            </span>
            <Switch
              checked={unitSaleEnabled}
              onCheckedChange={setUnitSaleEnabled}
              aria-label="Donalab sotish"
            />
          </div>
          <p className="text-caption text-text-tertiary">
            Qadoq narxi bo&rsquo;sh bo&rsquo;lsa — chegirmasiz (dona × soni). Qadoq
            o&rsquo;zgarishi qoldiqqa ta&rsquo;sir qilmaydi — hisob har doim donada.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="bg-danger/10 text-caption text-danger rounded-md p-3"
          >
            {error}
          </p>
        )}

        <section aria-label="Oxirgi harakatlar" className="space-y-2">
          <div className="flex items-center gap-2">
            <History className="text-text-tertiary size-4" aria-hidden />
            <h3 className="text-label flex-1">Oxirgi harakatlar</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => actions.onShowMovements(current.product)}
              className="text-primary-dark"
            >
              Barcha harakatlar
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </div>

          {detail.isPending ? (
            <div className="flex flex-col gap-2" aria-hidden>
              <Skeleton className="h-12 rounded-md" />
              <Skeleton className="h-12 rounded-md" />
              <Skeleton className="h-12 rounded-md" />
            </div>
          ) : detail.error && !card ? (
            <p className="text-caption text-danger">
              Harakatlar yuklanmadi — &laquo;Barcha harakatlar&raquo; orqali
              ko&rsquo;ring.
            </p>
          ) : movements.length === 0 ? (
            <p className="text-caption text-text-tertiary">Harakat yo&rsquo;q</p>
          ) : (
            <ul className="divide-border/60 border-border divide-y rounded-md border">
              {movements.map((movement) => (
                <li key={movement.id}>
                  <MovementRow movement={movement} hideProduct />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.onWriteOff(current.product)}
        >
          <MinusCircle className="size-4" aria-hidden />
          Chiqim qilish
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => actions.onReceive(current.product)}
        >
          <PackagePlus className="size-4" aria-hidden />
          Kirim qilish
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Yopish
        </Button>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          <Save className="size-4" aria-hidden />
          Saqlash
        </Button>
      </div>
    </DialogContent>
  );
}

/** The server's refusal in the desk's words, for the two codes the form can cause. */
function describeSaveError(error: unknown, boxLabel: string): string {
  if (!ApiError.is(error)) return "Saqlab bo'lmadi";
  switch (error.code) {
    case "packaging_price_conflict":
      return `${boxLabel} narxi dona narxidan katta bo'lishi kerak`;
    case "packaging_not_configured":
      return "Avval qadoqdagi dona sonini kiriting";
    default:
      return error.message;
  }
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-md border p-2.5">
      <p className="text-title-sm tabular">{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}
