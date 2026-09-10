"use client";

import { CheckCircle2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { formatProductUnits } from "@/features/products/types/product";
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
import { cn } from "@/shared/lib/utils";

import { useConfirmCount, useSaveCountLines } from "../hooks/use-warehouse";
import {
  countedCount,
  draftShortage,
  draftSurplus,
  lineDiff,
  uncountedCount,
  type StockCount,
  type StockCountLine,
} from "../types/count";

/**
 * Counting the shelves.
 *
 * The rule that shapes this screen: A LINE NOBODY COUNTED IS NOT A LINE COUNTED
 * AS ZERO. An empty box stays empty and is skipped at confirmation — typing 0
 * is how you say "none left", and the two must never be confused, because the
 * difference is the entire uncounted remainder of the shelf.
 *
 * What has been typed is saved as it goes, so a closed browser never loses an
 * afternoon of counting.
 */
export function StockCountDialog({
  count,
  open,
  onOpenChange,
}: {
  count: StockCount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && count && (
        <CountBody key={count.id} initial={count} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function CountBody({
  initial,
  onOpenChange,
}: {
  initial: StockCount;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useSaveCountLines();
  const confirm = useConfirmCount();

  const [lines, setLines] = useState<readonly StockCountLine[]>(initial.lines);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return lines;
    return lines.filter((line) => line.product.name.toLowerCase().includes(query));
  }, [lines, search]);

  const draft: StockCount = { ...initial, lines };
  const counted = countedCount(draft);
  const remaining = uncountedCount(draft);
  const shortage = draftShortage(lines);
  const surplus = draftSurplus(lines);

  function setCounted(productId: string, counted: number | null) {
    setLines((current) =>
      current.map((line) =>
        line.product.id === productId
          ? // A local edit invalidates the server's valuation of the OLD count.
            { ...line, countedQty: counted, serverDiffValue: null }
          : line,
      ),
    );
  }

  /** Persists one line as soon as the field is left — the counter moves on. */
  function persist(productId: string, value: number | null) {
    if (value === null) return;
    void save.mutateAsync({ id: initial.id, counted: { [productId]: value } });
  }

  async function onConfirm() {
    await confirm.mutateAsync(initial.id);
    onOpenChange(false);
  }

  return (
    <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[720px]">
      <DialogHeader>
        <DialogTitle>
          Inventarizatsiya{initial.number !== "" && ` · ${initial.number}`}
        </DialogTitle>
        <DialogDescription>
          Sanalmagan qator nol emas — bo&rsquo;sh qoldirilgan qatorlar tasdiqlashda
          o&rsquo;tkazib yuboriladi.
        </DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search
          className="text-text-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Mahsulot…"
          aria-label="Mahsulot qidirish"
          className="h-[38px] pl-9"
        />
      </div>

      <ul className="divide-border/60 border-border -mx-1 flex-1 divide-y overflow-y-auto rounded-md border">
        {visible.map((line) => {
          const diff = lineDiff(line);
          return (
            <li key={line.product.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="text-title-sm block truncate">{line.product.name}</span>
                <span className="text-caption text-text-tertiary tabular block truncate">
                  Kutilgan: {formatProductUnits(line.product, line.expectedQty)}
                </span>
              </span>

              {diff !== null && diff !== 0 && (
                <span
                  className={cn(
                    "text-label-xs tabular shrink-0 rounded-full px-2 py-0.5",
                    diff < 0 ? "bg-danger/12 text-danger" : "bg-success/12 text-success",
                  )}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </span>
              )}

              <Input
                inputMode="numeric"
                aria-label={`${line.product.name} sanog'i`}
                placeholder="—"
                value={line.countedQty === null ? "" : String(line.countedQty)}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "");
                  setCounted(line.product.id, raw === "" ? null : Number(raw));
                }}
                onBlur={() => persist(line.product.id, line.countedQty)}
                className="tabular h-[38px] w-[92px] shrink-0"
              />
            </li>
          );
        })}
      </ul>

      <div className="bg-surface-alt text-caption flex flex-wrap items-center gap-3 rounded-md p-3">
        <span className="text-text-secondary tabular">
          Sanaldi {counted} / {lines.length}
        </span>
        {remaining > 0 && (
          <span className="text-text-tertiary tabular">Qolgan {remaining}</span>
        )}
        {shortage > 0 && (
          <span className="text-danger tabular">Kamomad {shortage} dona</span>
        )}
        {surplus > 0 && (
          <span className="text-success tabular">Ortiqcha {surplus} dona</span>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Keyinroq davom ettirish
        </Button>
        <Button
          type="button"
          disabled={counted === 0 || confirm.isPending}
          onClick={() => void onConfirm()}
        >
          <CheckCircle2 className="size-4" aria-hidden />
          Yakunlash
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
