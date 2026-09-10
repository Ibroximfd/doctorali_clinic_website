"use client";

import { BellRing, Gift, History, Phone } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { clientDetailPath } from "@/config/routes";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { dayMonthYear, relativeDay } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi, telUri } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import type { FollowupFilter } from "../api/followups-api";
import { useFollowupsQuery } from "../hooks/use-followups";
import {
  DEFAULT_FOLLOWUP_ORDERING,
  DEFAULT_FOLLOWUP_PERIOD,
  FOLLOWUP_ORDERINGS,
  FOLLOWUP_PERIODS,
  FOLLOWUP_PERIOD_LABEL,
  FOLLOWUP_STATUSES,
  FOLLOWUP_STATUS_LABEL,
  type FollowupEntry,
  type FollowupPeriod,
  type FollowupStatus,
} from "../types/followup";
import { FollowupContactDialog } from "./followup-contact-dialog";
import { FollowupHistoryDialog } from "./followup-history-dialog";

const PAGE_SIZE = 20;
const ALL = "__all__";

/**
 * "Eslatmalar" — clients who bought a while ago and are due a call.
 *
 * The list is ordered oldest-purchase-first by default, so the person most
 * overdue for a call is at the top. Every row carries the phone as a `tel:`
 * link: the point of the page is to make the call, not to admire the list.
 */
export function FollowupsView() {
  const [period, setPeriod] = useState<FollowupPeriod>(DEFAULT_FOLLOWUP_PERIOD);
  const [status, setStatus] = useState<FollowupStatus | null>(null);
  const [ordering, setOrdering] = useState<string>(DEFAULT_FOLLOWUP_ORDERING);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [contacting, setContacting] = useState<FollowupEntry | null>(null);
  const [historyFor, setHistoryFor] = useState<FollowupEntry | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const filter = useMemo<FollowupFilter>(
    () => ({ period, status, ordering, search: debouncedSearch }),
    [period, status, ordering, debouncedSearch],
  );

  const list = useFollowupsQuery(filter, page);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Ism yoki telefon…"
          className="w-full sm:w-[280px]"
        />

        <div
          role="tablist"
          aria-label="Oxirgi xariddan beri"
          className="border-border bg-surface-alt inline-flex gap-1 rounded-md border p-1"
        >
          {FOLLOWUP_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => reset(setPeriod)(p)}
              className={cn(
                "text-label-sm rounded-sm px-2.5 py-1.5 whitespace-nowrap transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                period === p
                  ? "bg-surface text-primary-dark shadow-xs"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {FOLLOWUP_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        <Select
          value={status ?? ALL}
          onValueChange={reset((value: string) =>
            setStatus(value === ALL ? null : (value as FollowupStatus)),
          )}
        >
          <SelectTrigger className="w-[180px]" aria-label="Holat">
            <SelectValue placeholder="Barcha holatlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Barcha holatlar</SelectItem>
            {FOLLOWUP_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {FOLLOWUP_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Select value={ordering} onValueChange={reset(setOrdering)}>
          <SelectTrigger className="w-[200px]" aria-label="Saralash">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOLLOWUP_ORDERINGS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={76} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title="Eslatma yo'q"
            message="Tanlangan filtr bo'yicha eslatma yo'q."
          />
        ) : (
          <>
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((entry, index) => (
                <li
                  key={entry.client.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <FollowupRow
                    entry={entry}
                    onContact={() => setContacting(entry)}
                    onHistory={() => setHistoryFor(entry)}
                  />
                </li>
              ))}
            </ul>
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={list.data.count}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          </>
        )}
      </AppCard>

      <FollowupContactDialog
        entry={contacting}
        open={contacting !== null}
        onOpenChange={(open) => !open && setContacting(null)}
      />
      <FollowupHistoryDialog
        entry={historyFor}
        open={historyFor !== null}
        onOpenChange={(open) => !open && setHistoryFor(null)}
      />
    </PageContainer>
  );
}

const STATUS_TONE: Readonly<Record<FollowupStatus, string>> = {
  pending: "bg-surface-alt text-text-tertiary",
  contacted: "bg-info/12 text-info",
  not_interested: "bg-surface-alt text-text-secondary",
  ordered: "bg-primary-soft text-primary-dark",
  no_answer: "bg-warning/15 text-warning",
};

function FollowupRow({
  entry,
  onContact,
  onHistory,
}: {
  entry: FollowupEntry;
  onContact: () => void;
  onHistory: () => void;
}) {
  const { client, lastOrder, followup, giftStatus } = entry;
  const overdue = lastOrder.daysAgo >= 60;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5">
      <AppAvatar name={client.fullName} imageUrl={client.avatarUrl} size={40} />

      <div className="min-w-[12rem] flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={clientDetailPath(client.id)}
            className="text-title-sm focus-visible:ring-ring truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {client.fullName || "Mijoz"}
          </Link>
          <span
            className={cn(
              "text-label-xs shrink-0 rounded-full px-2 py-0.5",
              STATUS_TONE[followup.status],
            )}
          >
            {FOLLOWUP_STATUS_LABEL[followup.status]}
          </span>
          {giftStatus?.giftAvailable && (
            <span className="bg-gold/15 text-label-xs text-gold inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5">
              <Gift className="size-3" aria-hidden />
              Sovg&rsquo;a tayyor
            </span>
          )}
        </div>
        <p className="text-caption text-text-tertiary tabular mt-0.5 truncate">
          {phoneFromApi(client.phone)}
          {entry.doctor && ` · ${entry.doctor.fullName}`}
          {followup.lastContactedAt &&
            ` · oxirgi aloqa ${relativeDay(followup.lastContactedAt)}`}
        </p>
      </div>

      <div className="w-[150px] shrink-0">
        <p
          className={cn(
            "text-title-sm tabular",
            overdue ? "text-danger" : "text-text-primary",
          )}
        >
          {lastOrder.daysAgo} kun oldin
        </p>
        <p className="text-caption text-text-tertiary truncate">
          {dayMonthYear(lastOrder.date)}
        </p>
      </div>

      <div className="hidden w-[190px] shrink-0 lg:block">
        <p className="text-caption text-text-secondary truncate">
          {lastOrder.itemsSummary || "—"}
        </p>
        <p className="text-caption text-text-tertiary tabular">
          {entry.ordersCount} buyurtma · {money.plain(entry.totalSpent)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button asChild variant="outline" size="sm">
          <a href={telUri(client.phone)}>
            <Phone className="size-4" aria-hidden />
            Qo&rsquo;ng&rsquo;iroq
          </a>
        </Button>
        <Button size="sm" onClick={onContact}>
          Qayd etish
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onHistory}
          aria-label="Aloqa tarixi"
          className="text-text-secondary"
        >
          <History className="size-4" />
        </Button>
      </div>
    </div>
  );
}
