"use client";

import { CheckCircle2 } from "lucide-react";

import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { useDataQualityQuery } from "../hooks/use-clients";
import { isClean } from "../types/client-admin";

/**
 * How clean the client base is.
 *
 * Every number here is a to-do rather than a statistic: duplicate groups to
 * merge, cards with no name to fill in, phones that can't receive anything.
 */
export function DataQualityDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isPending, refetch } = useDataQualityQuery(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Ma&rsquo;lumot sifati</DialogTitle>
          <DialogDescription>
            Bazadagi to&rsquo;ldirilmagan va takrorlangan kartalar.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !data ? (
          <div className="grid grid-cols-2 gap-2" aria-hidden>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[68px] rounded-md" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {isClean(data) && (
              <p className="bg-success/10 text-caption text-success flex items-center gap-2 rounded-md p-3">
                <CheckCircle2 className="size-4" aria-hidden />
                Baza toza — tuzatish kerak bo&rsquo;lgan karta yo&rsquo;q.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Figure
                label="Dublikat guruh"
                value={data.duplicateGroups}
                tone={data.duplicateGroups > 0 ? "text-warning" : undefined}
              />
              <Figure
                label="Ismsiz karta"
                value={data.nameless}
                tone={data.nameless > 0 ? "text-warning" : undefined}
              />
              <Figure label="Tug'ilgan sanasiz" value={data.noBirthDate} />
              <Figure
                label="Noto'g'ri raqam"
                value={data.invalidPhone}
                tone={data.invalidPhone > 0 ? "text-danger" : undefined}
              />
            </div>

            <p className="text-caption text-text-tertiary tabular">
              Jami {data.totalClients} ta mijoz
            </p>

            {data.duplicateNames.length > 0 && (
              <div>
                <p className="text-label-xs text-text-tertiary mb-1">
                  Takrorlangan ismlar
                </p>
                <p className="text-caption text-text-secondary">
                  {data.duplicateNames.slice(0, 12).join(" · ")}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-border bg-surface-alt rounded-md border p-3">
      <p className={cn("text-headline-sm tabular", tone)}>{value}</p>
      <p className="text-caption text-text-tertiary">{label}</p>
    </div>
  );
}
