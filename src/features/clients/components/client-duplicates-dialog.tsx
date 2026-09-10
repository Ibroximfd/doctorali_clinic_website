"use client";

import { CheckCircle2, Merge } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";

import { useDuplicatesQuery } from "../hooks/use-clients";
import type { DuplicatePair } from "../types/client-admin";
import { recordName, type ClientRecord } from "../types/client-record";
import { ClientMergeDialog } from "./client-merge-dialog";

/**
 * The backend's merge candidates.
 *
 * Nothing here merges anything by itself: each pair opens the merge dialog,
 * which is where the decision is actually made and confirmed.
 */
export function ClientDuplicatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isPending, refetch } = useDuplicatesQuery(open);
  const [merging, setMerging] = useState<DuplicatePair | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>Dublikatlar</DialogTitle>
            <DialogDescription>
              Bir xil odamga tegishli bo&rsquo;lishi mumkin bo&rsquo;lgan kartalar. Qaysi
              biri qolishini siz hal qilasiz.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isPending ? (
            <div className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-[86px] rounded-md" />
              ))}
            </div>
          ) : (data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Dublikat topilmadi"
              message="Mijozlar bazasi toza."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {data?.map((pair) => (
                <li
                  key={`${pair.primary.id}:${pair.duplicate.id}`}
                  className="border-border rounded-md border p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                      <PairSide record={pair.primary} />
                      <PairSide record={pair.duplicate} />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMerging(pair)}
                    >
                      <Merge className="size-4" aria-hidden />
                      Birlashtirish
                    </Button>
                  </div>
                  {pair.reason !== "" && (
                    <p className="text-caption text-text-tertiary mt-2">{pair.reason}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <ClientMergeDialog
        pair={merging}
        open={merging !== null}
        onOpenChange={(next) => !next && setMerging(null)}
      />
    </>
  );
}

function PairSide({ record }: { record: ClientRecord }) {
  return (
    <div className="bg-surface-alt min-w-0 rounded-sm p-2">
      <p className="text-title-sm truncate">{recordName(record)}</p>
      <p className="text-caption text-text-tertiary tabular truncate">
        {phoneFromApi(record.phone)}
      </p>
      <p className="text-caption text-text-secondary tabular truncate">
        {record.visitsCount} tashrif · {money.plain(record.ordersTotal)}
      </p>
    </div>
  );
}
