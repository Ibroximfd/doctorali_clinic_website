"use client";

import { Save } from "lucide-react";
import { useState } from "react";

import { formatProductUnits } from "@/features/products/types/product";
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
import { Switch } from "@/shared/components/ui/switch";
import { shortDate } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";

import {
  useStockItemQuery,
  useUpdatePackaging,
  useUpdateStockSettings,
} from "../hooks/use-warehouse";
import type { PackagingUpdate } from "../api/warehouse-api";
import type { StockItem } from "../types/stock";
import { StockLevelBadge } from "./stock-level-badge";

/**
 * One product's stock card.
 *
 * There is deliberately no quantity field: a balance changes only through a
 * confirmed document. What CAN be edited here are settings — the low-stock
 * threshold, whether the product is tracked at all, and how it is boxed.
 */
export function StockDetailDialog({
  item,
  open,
  onOpenChange,
}: {
  item: StockItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && item && (
        <DetailBody key={item.product.id} item={item} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function DetailBody({
  item,
  onOpenChange,
}: {
  item: StockItem;
  onOpenChange: (open: boolean) => void;
}) {
  const detail = useStockItemQuery(item.product.id);
  const saveSettings = useUpdateStockSettings();
  const savePackaging = useUpdatePackaging();

  const product = item.product;
  const [minQuantity, setMinQuantity] = useState(item.minQuantity);
  const [trackStock, setTrackStock] = useState(item.trackStock);
  const [packageSize, setPackageSize] = useState<number | null>(product.packageSize);
  const [packageLabel, setPackageLabel] = useState(product.packageLabel);
  const [packagePrice, setPackagePrice] = useState<number | null>(product.packagePrice);
  const [unitSaleEnabled, setUnitSaleEnabled] = useState(product.unitSaleEnabled);

  const card = detail.data;
  const busy = saveSettings.isPending || savePackaging.isPending;

  async function save() {
    if (minQuantity !== item.minQuantity || trackStock !== item.trackStock) {
      await saveSettings.mutateAsync({
        productId: product.id,
        changes: {
          ...(minQuantity !== item.minQuantity ? { minQuantity } : {}),
          ...(trackStock !== item.trackStock ? { trackStock } : {}),
        },
      });
    }

    // Only what was actually touched is sent. `unit_price` is deliberately
    // never included: sending it at all switches the product into "the catalog
    // price is the box price" mode, which would change how it is sold.
    const packaging: PackagingUpdate = {
      ...(packageSize === null && product.packageSize !== null
        ? { clearPackageSize: true }
        : packageSize !== null && packageSize !== product.packageSize
          ? { packageSize }
          : {}),
      ...(packagePrice === null && product.packagePrice !== null
        ? { clearPackagePrice: true }
        : packagePrice !== null && packagePrice !== product.packagePrice
          ? { packagePrice }
          : {}),
      ...(unitSaleEnabled !== product.unitSaleEnabled ? { unitSaleEnabled } : {}),
      ...(packageLabel !== product.packageLabel ? { packageLabel } : {}),
    };

    if (Object.keys(packaging).length > 0) {
      await savePackaging.mutateAsync({
        productId: product.id,
        changes: packaging,
      });
    }
    onOpenChange(false);
  }

  return (
    <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2.5">
          <AppAvatar name={product.name} imageUrl={product.imageUrl} size={34} />
          <span className="min-w-0 truncate">{product.name}</span>
        </DialogTitle>
        <DialogDescription>
          Qoldiq faqat hujjat orqali o&rsquo;zgaradi — bu yerda sozlamalar tahrirlanadi.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="bg-surface-alt flex flex-wrap items-center gap-2 rounded-md p-3">
          <StockLevelBadge
            quantity={item.quantity}
            minQuantity={item.minQuantity}
            trackStock={item.trackStock}
            unitsText={formatProductUnits(product, item.quantity)}
          />
          <span className="text-caption text-text-secondary tabular">
            Tannarx {money.plain(item.costPrice)} · Qiymati {money.plain(item.stockValue)}
          </span>
          {item.lastReceiptAt && (
            <span className="text-caption text-text-tertiary tabular">
              Oxirgi kirim {shortDate(item.lastReceiptAt)}
            </span>
          )}
        </div>

        {card && (
          <div className="grid grid-cols-3 gap-2">
            <Figure label="30 kunda sotildi" value={`${card.sold30d} dona`} />
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
          </div>
          <div className="border-border flex items-center justify-between rounded-md border p-3">
            <span>
              <span className="text-label block">Qoldiq nazorati</span>
              <span className="text-caption text-text-tertiary block">
                O&rsquo;chiq bo&rsquo;lsa cheksiz hisoblanadi
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
          <p className="text-label">Qadoq</p>
          <div className="grid gap-2 sm:grid-cols-3">
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
            <div className="space-y-1">
              <span className="text-label-xs text-text-tertiary">Qadoq narxi</span>
              <MoneyInput
                value={packagePrice ?? 0}
                onValueChange={(value) => setPackagePrice(value === 0 ? null : value)}
                className="h-[38px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-caption text-text-secondary">
              Donalab sotishga ruxsat
            </span>
            <Switch
              checked={unitSaleEnabled}
              onCheckedChange={setUnitSaleEnabled}
              aria-label="Donalab sotish"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Yopish
        </Button>
        <Button type="button" disabled={busy} onClick={() => void save()}>
          <Save className="size-4" aria-hidden />
          Saqlash
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border rounded-md border p-2.5">
      <p className="text-title-sm tabular">{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}
