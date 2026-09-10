"use client";

import { ArrowLeftRight, Merge } from "lucide-react";
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
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { useMergeClients } from "../hooks/use-clients";
import { mergePreview, type DuplicatePair } from "../types/client-admin";
import { recordName, type ClientRecord } from "../types/client-record";

/**
 * Merges two cards into one.
 *
 * The most destructive action in the panel: every visit, order, debt and
 * treatment is re-pointed and the losing card ceases to exist. So it does three
 * things first — shows both cards side by side, states the RESULT in figures,
 * and makes the admin retype the surviving client's name. A wrong merge cannot
 * be undone by pressing anything.
 */
export function ClientMergeDialog({
  pair,
  open,
  onOpenChange,
  onMerged,
}: {
  pair: DuplicatePair | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMerged?: (survivor: ClientRecord) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && pair && (
        <MergeBody
          key={`${pair.primary.id}:${pair.duplicate.id}`}
          pair={pair}
          onOpenChange={onOpenChange}
          onMerged={onMerged}
        />
      )}
    </Dialog>
  );
}

function MergeBody({
  pair,
  onOpenChange,
  onMerged,
}: {
  pair: DuplicatePair;
  onOpenChange: (open: boolean) => void;
  onMerged?: (survivor: ClientRecord) => void;
}) {
  const merge = useMergeClients();
  // Which card survives. Defaults to the backend's suggestion, but the admin
  // can flip it — sometimes the "duplicate" is the better-filled record.
  const [keepPrimary, setKeepPrimary] = useState(true);
  const [typed, setTyped] = useState("");

  const primary = keepPrimary ? pair.primary : pair.duplicate;
  const secondary = keepPrimary ? pair.duplicate : pair.primary;
  const preview = mergePreview(pair);
  const survivorName = recordName(primary);
  const confirmed = typed.trim().toLowerCase() === survivorName.trim().toLowerCase();

  async function submit() {
    if (!confirmed || primary.id === null || secondary.id === null) return;
    const survivor = await merge.mutateAsync({
      primaryId: primary.id,
      duplicateId: secondary.id,
    });
    onMerged?.(survivor);
    onOpenChange(false);
  }

  return (
    <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[620px]">
      <DialogHeader>
        <DialogTitle>Kartalarni birlashtirish</DialogTitle>
        <DialogDescription>
          {pair.reason || "Bu ikki karta bitta odamga tegishli bo'lishi mumkin."}{" "}
          Birlashtirilgandan keyin ortga qaytarib bo&rsquo;lmaydi.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <CardSide record={primary} kept />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Qaysi karta qolishini almashtirish"
            onClick={() => {
              setKeepPrimary((current) => !current);
              // The confirmation names a specific card, so flipping resets it.
              setTyped("");
            }}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
          </Button>
          <CardSide record={secondary} kept={false} />
        </div>

        <div className="border-border bg-surface-alt rounded-md border p-3">
          <p className="text-label-xs text-text-tertiary mb-2">Natija</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Figure label="Tashrif" value={String(preview.visits)} />
            <Figure label="Buyurtma" value={String(preview.orders)} />
            <Figure label="Xarid" value={money.plain(preview.ordersTotal)} />
            <Figure
              label="Qarz"
              value={money.plain(preview.openDebt)}
              tone={preview.openDebt > 0 ? "text-warning" : undefined}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="merge-confirm">
            Tasdiqlash uchun qoladigan mijoz ismini yozing:{" "}
            <span className="font-semibold">{survivorName}</span>
          </Label>
          <Input
            id="merge-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={survivorName}
            className="h-[42px]"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Bekor qilish
        </Button>
        <Button
          type="button"
          disabled={!confirmed || merge.isPending}
          className="bg-danger hover:bg-danger/90 text-danger-foreground"
          onClick={() => void submit()}
        >
          <Merge className="size-4" aria-hidden />
          Birlashtirish
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CardSide({ record, kept }: { record: ClientRecord; kept: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border p-3",
        kept ? "border-primary bg-primary-soft" : "border-border bg-surface opacity-70",
      )}
    >
      <p className="text-label-xs text-text-tertiary">
        {kept ? "Qoladi" : "O'chiriladi"}
      </p>
      <p className="text-title-sm truncate">{recordName(record)}</p>
      <p className="text-caption text-text-tertiary tabular truncate">
        {phoneFromApi(record.phone)}
      </p>
      <p className="text-caption text-text-secondary tabular mt-1">
        {record.visitsCount} tashrif · {record.ordersCount} buyurtma ·{" "}
        {money.plain(record.ordersTotal)}
      </p>
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-label-xs text-text-tertiary">{label}</p>
      <p className={cn("text-title-sm tabular", tone)}>{value}</p>
    </div>
  );
}
