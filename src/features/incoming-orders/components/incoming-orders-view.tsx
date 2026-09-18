"use client";

import { Banknote, CircleCheck, Hourglass, Inbox } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppRoutes, clientDetailPath } from "@/config/routes";
import { shortOrderNumber } from "@/features/orders/types/order";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import {
  FilterBar,
  FilterSelect,
  SortSelect,
} from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import type { DateRange } from "@/shared/domain/date-range";
import { activeRangeLabel } from "@/shared/domain/date-range-label";
import { ORDER_TYPE_LABEL, type OrderType } from "@/shared/domain/order-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { hhmm, shortDate, shortDateTime } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import type {
  IncomingOrdersFilter,
  IncomingPaidFilter,
} from "../api/incoming-orders-api";
import {
  useIncomingFilterOptionsQuery,
  useIncomingOrdersQuery,
  useIncomingOrdersStatsQuery,
} from "../hooks/use-incoming-orders";
import {
  INCOMING_ORDERING_FALLBACK,
  PAID_FILTERS,
  incomingListSearchParams,
  useIncomingUrlFilter,
} from "../hooks/use-incoming-url-filter";
import {
  INCOMING_GROUP_LABEL,
  INCOMING_STATUS_GROUPS,
  type IncomingOrderSummary,
  type IncomingStatusGroup,
} from "../types/incoming-order";
import {
  IncomingGiftBadge,
  IncomingPaidBadge,
  IncomingStatusBadge,
  IncomingTypeBadge,
  SourceMark,
} from "./incoming-badges";
import { IncomingOrderDetailDialog } from "./incoming-order-detail-dialog";

const PAGE_SIZE = 20;

/**
 * "Doctor Ali app" — everything the app and the doctors sold, in ONE mixed
 * list (read-only §1). The origin is never labelled; the only trace is the
 * discreet `SourceMark` dot the owner knows about.
 *
 * The default period is ALL TIME on purpose (§3): a list silently cut to a
 * month reads as "buyurtma yo'qolib qoldi" at the desk.
 */
export function IncomingOrdersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 63.98rem)");

  // The URL is where this list keeps its state: every filter below is seeded
  // from it and written back as it changes, so Back from a client card lands
  // on the exact list the desk left.
  const urlFilter = useIncomingUrlFilter(searchParams);

  const [statusGroup, setStatusGroup] = useState(urlFilter.statusGroup);
  const [search, setSearch] = useState(urlFilter.search);
  const [range, setRange] = useState<DateRange | null>(urlFilter.range);
  const [paymentMethod, setPaymentMethod] = useState(urlFilter.paymentMethod);
  const [paidFilter, setPaidFilter] = useState(urlFilter.paidFilter);
  const [orderType, setOrderType] = useState(urlFilter.orderType);
  const [giftOnly, setGiftOnly] = useState(urlFilter.giftOnly);
  const [ordering, setOrdering] = useState(urlFilter.ordering);
  const [page, setPage] = useState(urlFilter.page);

  const [detailId, setDetailId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const options = useIncomingFilterOptionsQuery();

  const filter = useMemo<IncomingOrdersFilter>(
    () => ({
      statusGroup,
      range,
      paymentMethod,
      paidFilter,
      orderType,
      giftOnly,
      search: debouncedSearch,
      ordering,
    }),
    [
      statusGroup,
      range,
      paymentMethod,
      paidFilter,
      orderType,
      giftOnly,
      debouncedSearch,
      ordering,
    ],
  );

  const list = useIncomingOrdersQuery(filter, page);
  const stats = useIncomingOrdersStatsQuery(filter);

  // Mirror the state into the URL — `replace`, so the history holds one entry
  // per visit rather than one per keystroke.
  const urlState = incomingListSearchParams({
    statusGroup,
    range,
    paymentMethod,
    paidFilter,
    orderType,
    giftOnly,
    ordering,
    search: debouncedSearch,
    page,
  });
  useEffect(() => {
    if (urlState === searchParams.toString()) return;
    router.replace(
      urlState ? `${AppRoutes.incomingOrders}?${urlState}` : AppRoutes.incomingOrders,
      { scroll: false },
    );
  }, [urlState, searchParams, router]);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function clearAll() {
    setStatusGroup(null);
    setSearch("");
    setRange(null);
    setPaymentMethod(null);
    setPaidFilter(null);
    setOrderType(null);
    setGiftOnly(false);
    setPage(1);
  }

  const orderings =
    options.data && options.data.orderings.length > 0
      ? options.data.orderings
      : INCOMING_ORDERING_FALLBACK;
  const paymentMethods = options.data?.paymentMethods ?? [];

  const extraCount = [paidFilter, orderType, giftOnly ? "1" : null].filter(
    (value) => value !== null,
  ).length;

  const chips = [
    ...(statusGroup
      ? [
          {
            id: "status",
            label: INCOMING_GROUP_LABEL[statusGroup],
            emphasized: true,
            onClear: () => reset(setStatusGroup)(null),
          },
        ]
      : []),
    ...(range
      ? [
          {
            id: "range",
            label: activeRangeLabel(range),
            emphasized: true,
            onClear: () => reset(setRange)(null),
          },
        ]
      : []),
    ...(paidFilter
      ? [
          {
            id: "paid",
            label:
              PAID_FILTERS.find((item) => item.value === paidFilter)?.label ?? "To'lov",
            onClear: () => reset(setPaidFilter)(null),
          },
        ]
      : []),
    ...(paymentMethod
      ? [
          {
            id: "method",
            label:
              paymentMethods.find((item) => item.value === paymentMethod)?.label ??
              paymentMethod,
            onClear: () => reset(setPaymentMethod)(null),
          },
        ]
      : []),
    ...(orderType
      ? [
          {
            id: "orderType",
            label: ORDER_TYPE_LABEL[orderType],
            onClear: () => reset(setOrderType)(null),
          },
        ]
      : []),
    ...(giftOnly
      ? [
          {
            id: "gift",
            label: "Sovg'ali",
            onClear: () => reset(setGiftOnly)(false),
          },
        ]
      : []),
    ...(debouncedSearch.trim()
      ? [
          {
            id: "search",
            label: `“${debouncedSearch.trim()}”`,
            onClear: () => reset(setSearch)(""),
          },
        ]
      : []),
  ];

  return (
    <PageContainer className="flex flex-col gap-4">
      <StatusGroupTabs value={statusGroup} onChange={reset(setStatusGroup)} />

      <FilterBar
        extraCount={extraCount}
        extra={
          <>
            <FilterSelect
              label="Buyurtma turi"
              value={orderType}
              onChange={reset(setOrderType)}
              options={[
                { value: "clinic" as OrderType, label: ORDER_TYPE_LABEL.clinic },
                { value: "delivery" as OrderType, label: ORDER_TYPE_LABEL.delivery },
              ]}
              allLabel="Barcha turlar"
              width="w-[160px]"
            />
            <FilterSelect
              label="Sovg'a"
              value={giftOnly ? "1" : null}
              onChange={(value) => reset(setGiftOnly)(value === "1")}
              options={[{ value: "1", label: "Sovg'ali buyurtmalar" }]}
              allLabel="Sovg'a: hammasi"
              width="w-[190px]"
            />
            <SortSelect
              value={ordering}
              onChange={reset(setOrdering)}
              options={orderings}
            />
          </>
        }
      >
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Raqam, ism yoki telefon…"
          className="w-full sm:w-[280px]"
        />
        <DateFilter value={range} onChange={reset(setRange)} />
        <FilterSelect
          label="To'lov holati"
          value={paidFilter}
          onChange={reset(setPaidFilter)}
          options={PAID_FILTERS.map((item) => ({
            value: item.value as IncomingPaidFilter,
            label: item.label,
          }))}
          allLabel="To'lov: hammasi"
        />
        {/* Dictionary-driven (§7); the dropdown simply hides until it loads. */}
        {paymentMethods.length > 0 && (
          <FilterSelect
            label="To'lov turi"
            value={paymentMethod}
            onChange={reset(setPaymentMethod)}
            options={paymentMethods.map((item) => ({
              value: item.value,
              label: item.label,
            }))}
            allLabel="Barcha to'lovlar"
          />
        )}
      </FilterBar>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <ActiveFilters filters={chips} onClearAll={clearAll} className="min-w-0 flex-1" />
        {list.data && (
          <span className="text-caption text-text-tertiary tabular shrink-0">
            {list.data.count} ta buyurtma
          </span>
        )}
      </div>

      {stats.data && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Buyurtmalar"
            value={`${stats.data.count} ta`}
            hint={`${stats.data.itemCount} dona mahsulot`}
            icon={Inbox}
            tone="neutral"
          />
          <StatCard
            label="To'lanadigan"
            value={money.uzs(stats.data.payableAmount)}
            hint={
              stats.data.totalAmount !== stats.data.payableAmount
                ? `Jami: ${money.uzs(stats.data.totalAmount)}`
                : undefined
            }
            icon={Banknote}
            tone="primary"
          />
          <StatCard
            label="Kelgan pul"
            value={money.uzs(stats.data.paidAmount)}
            icon={CircleCheck}
            tone="primary"
          />
          <StatCard
            label="To'lanmagan"
            value={money.uzs(stats.data.unpaidAmount)}
            icon={Hourglass}
            tone={stats.data.unpaidAmount > 0 ? "warning" : "neutral"}
          />
        </div>
      )}

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={9} height={56} />
        ) : list.data.results.length === 0 ? (
          chips.length > 0 ? (
            <EmptyState
              icon={Inbox}
              title="Hech narsa topilmadi"
              message="Tanlangan filtrga mos buyurtma yo'q — filtrlarni kengaytirib ko'ring."
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="Buyurtmalar hali yo'q"
              message="Doctor Ali ilovasidan kelgan buyurtmalar shu yerda ko'rinadi."
            />
          )
        ) : (
          <>
            {!isMobile && <IncomingTableHeader />}
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((order, index) => (
                <li
                  key={order.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  {isMobile ? (
                    <IncomingCard order={order} onOpen={() => setDetailId(order.id)} />
                  ) : (
                    <IncomingTableRow
                      order={order}
                      onOpen={() => setDetailId(order.id)}
                    />
                  )}
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

      <IncomingOrderDetailDialog
        orderId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
      />
    </PageContainer>
  );
}

/**
 * The status buckets as one pill row — the filter the desk reaches for first,
 * so it sits above the toolbar instead of inside a dropdown.
 */
function StatusGroupTabs({
  value,
  onChange,
}: {
  value: IncomingStatusGroup | null;
  onChange: (value: IncomingStatusGroup | null) => void;
}) {
  const tabs: readonly { value: IncomingStatusGroup | null; label: string }[] = [
    { value: null, label: "Hammasi" },
    ...INCOMING_STATUS_GROUPS.map((group) => ({
      value: group,
      label: INCOMING_GROUP_LABEL[group],
    })),
  ];

  return (
    <div role="tablist" aria-label="Buyurtma holati" className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.value ?? "all"}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "text-label-sm rounded-full px-3.5 py-1.5 transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            value === tab.value
              ? "bg-primary text-primary-foreground"
              : "bg-surface-alt text-text-secondary hover:text-text-primary",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/*
 * Fixed columns; the ONE flexible column is the client. Everything else is a
 * number, a badge or a name that truncates, so nothing wraps a row.
 */
const GRID =
  "grid grid-cols-[86px_92px_minmax(170px,1.4fr)_minmax(110px,1fr)_44px_minmax(110px,0.8fr)_minmax(104px,0.8fr)_minmax(112px,0.9fr)] items-center gap-2.5 px-4";

function IncomingTableHeader() {
  const columns = [
    { label: "Raqam" },
    { label: "Sana" },
    { label: "Mijoz" },
    { label: "Shifokor" },
    { label: "Dona", right: true },
    { label: "Summa", right: true },
    { label: "To'lov" },
    { label: "Holat" },
  ];

  return (
    <div className={cn(GRID, "border-border bg-surface-alt/40 border-b py-2.5")}>
      {columns.map((column) => (
        <span
          key={column.label}
          className={cn(
            "text-label-xs text-text-tertiary truncate uppercase",
            column.right && "text-right",
          )}
        >
          {column.label}
        </span>
      ))}
    </div>
  );
}

function IncomingTableRow({
  order,
  onOpen,
}: {
  order: IncomingOrderSummary;
  onOpen: () => void;
}) {
  const cancelled = order.statusGroup === "cancelled";

  return (
    // The whole row opens the order; the client link inside stops the event so
    // it still does its own job.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${order.orderNumber} buyurtmasini ochish`}
      className={cn(
        GRID,
        "hover:bg-surface-hover focus-visible:ring-ring cursor-pointer py-2.5 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center" title={order.orderNumber}>
        <span className="text-title-sm tabular truncate">
          {shortOrderNumber(order.orderNumber)}
        </span>
        <SourceMark source={order.source} />
      </div>

      <div className="min-w-0">
        <span className="text-body-sm tabular block truncate">
          {shortDate(order.createdAt)}
        </span>
        <span className="text-caption text-text-tertiary tabular block">
          {hhmm(order.createdAt)}
        </span>
      </div>

      <div className="min-w-0">
        {order.cardId ? (
          <Link
            href={clientDetailPath(order.cardId)}
            onClick={(event) => event.stopPropagation()}
            className="text-title-sm focus-visible:ring-ring inline-block max-w-full truncate rounded-sm align-bottom hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {order.clientName || "Mijoz"}
          </Link>
        ) : (
          <span className="text-title-sm block truncate">
            {order.clientName || "Mijoz"}
          </span>
        )}
        <div className="flex min-w-0 items-center gap-1 overflow-hidden">
          <span className="text-caption text-text-tertiary tabular shrink-0">
            {phoneFromApi(order.clientPhone)}
          </span>
          <IncomingGiftBadge order={order} />
          <IncomingTypeBadge order={order} />
        </div>
      </div>

      <div className="min-w-0">
        {order.doctorName ? (
          <span className="text-body-sm text-text-secondary block truncate">
            {order.doctorName}
          </span>
        ) : (
          <span className="text-body-sm text-text-tertiary">—</span>
        )}
      </div>

      <span className="text-body-sm tabular text-right">{order.itemCount}</span>

      {/* Payable is the figure the courier is told (§4); the goods total only
          appears when a cashback/points discount made the two differ. */}
      <div className="min-w-0 text-right">
        <span className="text-title-sm tabular block">
          {money.plain(order.payableAmount)}
        </span>
        {order.totalAmount !== order.payableAmount && (
          <span className="text-caption text-text-tertiary tabular block line-through">
            {money.plain(order.totalAmount)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <IncomingPaidBadge order={order} />
        {order.paymentMethodDisplay !== "" && (
          <span className="text-caption text-text-tertiary max-w-full truncate">
            {order.paymentMethodDisplay}
          </span>
        )}
      </div>

      <div className="flex min-w-0">
        <IncomingStatusBadge order={order} />
      </div>
    </div>
  );
}

function IncomingCard({
  order,
  onOpen,
}: {
  order: IncomingOrderSummary;
  onOpen: () => void;
}) {
  const cancelled = order.statusGroup === "cancelled";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "hover:bg-surface-hover flex w-full flex-col gap-2.5 px-4 py-3.5 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        cancelled && "opacity-60",
      )}
    >
      {/* Row 1: identity — the number, the moment, and the status pill that
          answers "what is happening with it" before the card is even read. */}
      <div className="flex items-center gap-2">
        <span className="flex min-w-0 items-center" title={order.orderNumber}>
          <span
            className={cn("text-title-sm tabular truncate", cancelled && "line-through")}
          >
            {shortOrderNumber(order.orderNumber)}
          </span>
          <SourceMark source={order.source} />
        </span>
        <span className="text-caption text-text-tertiary tabular shrink-0">
          {shortDateTime(order.createdAt)}
        </span>
        <span className="ml-auto shrink-0">
          <IncomingStatusBadge order={order} />
        </span>
      </div>

      {/* Row 2: who and how much — the two facts the desk scans a card for,
          face on the left, money right-aligned so amounts line up down the
          list. */}
      <div className="flex items-center gap-2.5">
        <AppAvatar name={order.clientName || "Mijoz"} imageUrl={null} size={36} />
        <div className="min-w-0 flex-1">
          <p className="text-title-sm truncate">{order.clientName || "Mijoz"}</p>
          <p className="text-caption text-text-tertiary tabular truncate">
            {phoneFromApi(order.clientPhone)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-title tabular leading-tight">
            {money.plain(order.payableAmount)}
          </p>
          {order.totalAmount !== order.payableAmount ? (
            <p className="text-caption text-text-tertiary tabular line-through">
              {money.plain(order.totalAmount)}
            </p>
          ) : (
            <p className="text-caption text-text-tertiary tabular">
              {order.itemCount} dona
            </p>
          )}
        </div>
      </div>

      {/* Row 3: the qualifiers, behind a hairline so the card reads as three
          calm bands — payment facts on the left, the doctor closing it. */}
      <div className="border-surface-alt flex items-center gap-1.5 border-t pt-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <IncomingPaidBadge order={order} />
          <IncomingTypeBadge order={order} />
          <IncomingGiftBadge order={order} />
          {order.paymentMethodDisplay !== "" && (
            <span className="text-caption text-text-tertiary truncate">
              {order.paymentMethodDisplay}
            </span>
          )}
        </div>
        {order.doctorName !== "" && (
          <span className="text-caption text-text-secondary max-w-[45%] shrink-0 truncate">
            {order.doctorName}
          </span>
        )}
      </div>
    </button>
  );
}
