"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { DateFilter } from "@/shared/components/data-display/date-filter";
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
import { resolveRange, type DateRange } from "@/shared/domain/date-range";
import { rangeLabel } from "@/shared/domain/date-range-label";

/**
 * Asks for the period before the stock room is exported.
 *
 * The sheet is a REPORT — what was sold, gifted, taken in and written off on
 * each day of the range, next to the balance the period ended on — so the range
 * has to be the desk's choice, not a fixed "this month". It still opens on this
 * month, which is what gets exported most.
 */
export function WarehouseExportDialog({
  open,
  onOpenChange,
  busy,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onExport: (range: DateRange) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ExportBody
          busy={busy}
          onExport={onExport}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

function ExportBody({
  busy,
  onExport,
  onCancel,
}: {
  busy: boolean;
  onExport: (range: DateRange) => void;
  onCancel: () => void;
}) {
  const [range, setRange] = useState<DateRange>(() => resolveRange("monthly"));

  return (
    <DialogContent className="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle>Sklad hisoboti (Excel)</DialogTitle>
        <DialogDescription>
          Tanlangan davr uchun: har kuni sotilgan, sovg&rsquo;a qilingan, kirim va chiqim
          qilingan mahsulotlar — davr oxiridagi qoldiq bilan.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label>Davr</Label>
        <DateFilter
          value={range}
          // Never clearable: the sheet is about a period, and "no period" is a
          // different document (balances only) the desk did not ask for.
          onChange={(next) => next && setRange(next)}
          clearable={false}
          steppable={false}
        />
        <p className="text-caption text-text-tertiary">{rangeLabel(range)}</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Bekor qilish
        </Button>
        <Button type="button" disabled={busy} onClick={() => onExport(range)}>
          <Download className="size-4" aria-hidden />
          {busy ? "Tayyorlanmoqda…" : "Yuklab olish"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
