"use client";

import { History } from "lucide-react";

import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { dayMonthTime } from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { useFollowupHistoryQuery } from "../hooks/use-followups";
import { type FollowupEntry, type FollowupStatus } from "../types/followup";

const STATUS_TONE: Readonly<Record<FollowupStatus, string>> = {
  pending: "bg-surface-alt text-text-tertiary",
  contacted: "bg-info/12 text-info",
  not_interested: "bg-surface-alt text-text-secondary",
  ordered: "bg-primary-soft text-primary-dark",
  no_answer: "bg-warning/15 text-warning",
};

/** Every past call to this client, newest first. */
export function FollowupHistoryDialog({
  entry,
  open,
  onOpenChange,
}: {
  entry: FollowupEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, error, isPending, refetch } = useFollowupHistoryQuery(
    open && entry ? entry.client.id : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Aloqa tarixi</DialogTitle>
          <DialogDescription className="tabular">
            {entry?.client.fullName || "Mijoz"}
            {entry && ` · ${phoneFromApi(entry.client.phone)}`}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-md" />
            ))}
          </div>
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={History}
            title="Aloqa yo'q"
            message="Bu mijoz bilan hali bog'lanilmagan."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.results.map((item, index) => (
              <li
                key={`${item.contactedAt.getTime()}-${index}`}
                className="border-border rounded-md border p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-label-xs rounded-full px-2 py-0.5",
                      STATUS_TONE[item.status],
                    )}
                  >
                    {item.statusDisplay}
                  </span>
                  <span className="text-caption text-text-tertiary ml-auto">
                    {dayMonthTime(item.contactedAt)}
                  </span>
                </div>
                {item.note !== "" && (
                  <p className="text-body-sm text-text-secondary mt-1.5">{item.note}</p>
                )}
                {item.contactedByName !== "" && (
                  <p className="text-caption text-text-tertiary mt-1">
                    {item.contactedByName}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
