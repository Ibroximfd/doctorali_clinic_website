"use client";

import {
  Ban,
  BadgeCheck,
  BellRing,
  CalendarClock,
  CalendarOff,
  CalendarX2,
  Check,
  CircleSlash,
  CreditCard,
  Footprints,
  Gift,
  History,
  KeyRound,
  Merge,
  Phone,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  StickyNote,
  Tags,
  TriangleAlert,
  UserPlus,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { FilialTag } from "@/shared/components/data-display/filial-tag";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { DateRange } from "@/shared/domain/date-range";
import { rangeLabel } from "@/shared/domain/date-range-label";
import { addDays, shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { useClientTimelineQuery } from "../hooks/use-client-profile";
import {
  CLIENT_EVENT_FILTERS,
  CLIENT_EVENT_FILTER_LABEL,
  eventTone,
  type ClientEvent,
  type ClientEventFilter,
  type ClientEventKind,
  type EventTone,
} from "../types/client-event";

const PAGE_SIZE = 20;

const ICON: Readonly<Record<ClientEventKind, LucideIcon>> = {
  client_created: UserPlus,
  app_linked: Smartphone,
  account_opened: BadgeCheck,
  password_reset: KeyRound,
  visit_scheduled: CalendarClock,
  visit_arrived: Footprints,
  visit_cancelled: CalendarX2,
  visit_no_show: CalendarOff,
  order_created: ShoppingCart,
  order_cancelled: XCircle,
  treatment_done: Stethoscope,
  treatment_cancelled: XCircle,
  debt_created: CreditCard,
  debt_payment: Wallet,
  debt_closed: Check,
  debt_overdue: TriangleAlert,
  gift_granted: Gift,
  contacted: Phone,
  note_added: StickyNote,
  tag_changed: Tags,
  notification_sent: BellRing,
  merged: Merge,
  blocked: Ban,
  anonymized: UserX,
  unknown: CircleSlash,
};

const TONE_CLASS: Readonly<Record<EventTone, string>> = {
  success: "bg-success/12 text-success",
  info: "bg-info/12 text-info",
  warning: "bg-warning/12 text-warning",
  danger: "bg-danger/12 text-danger",
  accent: "bg-gold/12 text-gold",
  muted: "bg-surface-alt text-text-tertiary",
};

/**
 * The client's history feed.
 *
 * Every row's sentence comes verbatim from the server (`title`), which is what
 * keeps the panel and the backend from ever describing the same event
 * differently. The app supplies only the icon, the colour and the time.
 */
export function ClientTimeline({ clientId }: { clientId: number }) {
  const [filter, setFilter] = useState<ClientEventFilter>("all");
  const [range, setRange] = useState<DateRange | null>(null);
  const [page, setPage] = useState(1);

  const timeline = useClientTimelineQuery({
    clientId,
    filter,
    page,
    dateFrom: range?.start ?? null,
    // The app's range end is exclusive; the API's `date_to` is inclusive.
    dateTo: range ? addDays(range.end, -1) : null,
  });
  const events = timeline.data?.results ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DateFilter
          value={range}
          onChange={(next) => {
            setRange(next);
            setPage(1);
          }}
          steppable={false}
        />
        {range && (
          <span className="text-caption text-text-tertiary">
            {rangeLabel(range)} oralig&rsquo;idagi hodisalar
          </span>
        )}
      </div>

      <div role="tablist" aria-label="Hodisa turi" className="flex flex-wrap gap-1.5">
        {CLIENT_EVENT_FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            onClick={() => {
              setFilter(option);
              setPage(1);
            }}
            className={cn(
              "text-label-sm rounded-full border px-3 py-1 transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              filter === option
                ? "border-primary bg-primary-soft text-primary-dark"
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {CLIENT_EVENT_FILTER_LABEL[option]}
          </button>
        ))}
      </div>

      {timeline.error && !timeline.data ? (
        <ErrorState
          error={timeline.error}
          onRetry={() => void timeline.refetch()}
          title="Tarixni yuklab bo'lmadi"
        />
      ) : timeline.isPending ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-sm" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title="Tarix bo'sh"
          message="Bu mijoz bo'yicha hali hodisa yo'q."
        />
      ) : (
        <>
          <ol
            className="flex flex-col"
            style={{ opacity: timeline.isPlaceholderData ? 0.6 : 1 }}
            aria-busy={timeline.isPlaceholderData}
          >
            {events.map((event, index) => (
              <TimelineRow
                key={event.id}
                event={event}
                isLast={index === events.length - 1}
              />
            ))}
          </ol>
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            total={timeline.data?.count ?? 0}
            onPageChange={setPage}
            busy={timeline.isFetching}
          />
        </>
      )}
    </div>
  );
}

function TimelineRow({ event, isLast }: { event: ClientEvent; isLast: boolean }) {
  const Icon = ICON[event.kind];
  const who = event.doctor?.fullName ?? event.actor?.fullName ?? "";

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-full",
            TONE_CLASS[eventTone(event.kind)],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        {/* The rail stops at the last row rather than trailing into nothing. */}
        {!isLast && <span className="bg-border w-px flex-1" aria-hidden />}
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-body-sm min-w-0 flex-1">{event.title}</p>
          {event.amount !== null && event.amount !== 0 && (
            <span className="text-title-sm tabular shrink-0">
              {money.plain(event.amount)}
            </span>
          )}
        </div>
        <p className="text-caption text-text-tertiary tabular flex flex-wrap items-center gap-x-2">
          <span>
            {shortDateTime(event.createdAt)}
            {who !== "" && ` · ${who}`}
          </span>
          <FilialTag filial={event.filial} />
        </p>
      </div>
    </li>
  );
}
