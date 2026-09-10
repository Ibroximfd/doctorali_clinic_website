"use client";

import {
  CalendarClock,
  CalendarPlus,
  CircleCheck,
  Download,
  HandCoins,
  TriangleAlert,
  Wallet,
} from "lucide-react";
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
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { dayMonthYear } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import {
  DEBT_VIEWS,
  DEBT_VIEW_LABEL,
  type DebtFilter,
  type DebtView,
} from "../api/debts-api";
import { useDebtSummaryQuery, useDebtsExport, useDebtsQuery } from "../hooks/use-debts";
import { debtSourceLabel, debtSourceRef, isDebtPayable, type Debt } from "../types/debt";
import { DebtExtendDialog } from "./debt-extend-dialog";
import { DebtPayDialog } from "./debt-pay-dialog";
import { DebtStatusBadge, DueDateBadge } from "./debt-status-badge";

const PAGE_SIZE = 20;

/** "Qarzlar" — who owes what, and which deadline is next. */
export function DebtsView() {
  const [view, setView] = useState<DebtView>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState<Debt | null>(null);
  const [extending, setExtending] = useState<Debt | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const filter = useMemo<DebtFilter>(
    () => ({ view, search: debouncedSearch, ordering: "due_date" }),
    [view, debouncedSearch],
  );

  const list = useDebtsQuery(filter, page);
  const summary = useDebtSummaryQuery();
  const exportMutation = useDebtsExport();

  function selectView(next: DebtView) {
    setView(next);
    setPage(1);
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      {summary.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Ochiq qarzlar"
            amount={summary.data.openAmount}
            count={summary.data.openCount}
            icon={Wallet}
            tone="warning"
            active={view === "open"}
            onClick={() => selectView("open")}
          />
          <SummaryTile
            label="Muddati o'tgan"
            amount={summary.data.overdueAmount}
            count={summary.data.overdueCount}
            icon={TriangleAlert}
            tone="danger"
            active={view === "overdue"}
            onClick={() => selectView("overdue")}
          />
          <SummaryTile
            label="Bugun muddati"
            amount={summary.data.dueTodayAmount}
            count={summary.data.dueTodayCount}
            icon={CalendarClock}
            tone="info"
            active={view === "dueToday"}
            onClick={() => selectView("dueToday")}
          />
          <SummaryTile
            label="Bugun yig'ildi"
            amount={summary.data.collectedToday}
            icon={CircleCheck}
            tone="primary"
            active={view === "paid"}
            onClick={() => selectView("paid")}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Ism, telefon yoki buyurtma raqami…"
          className="w-full sm:w-[320px]"
        />
        <div
          role="tablist"
          aria-label="Qarz ko'rinishi"
          className="border-border bg-surface-alt inline-flex gap-1 rounded-md border p-1"
        >
          {DEBT_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => selectView(v)}
              className={cn(
                "text-label-sm rounded-sm px-3 py-1.5 whitespace-nowrap transition-colors",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                view === v
                  ? "bg-surface text-primary-dark shadow-xs"
                  : "text-text-secondary hover:text-text-primary",
              )}
            >
              {DEBT_VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate(filter)}
          disabled={exportMutation.isPending}
        >
          <Download className="size-4" aria-hidden />
          Excel
        </Button>
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={72} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Qarz topilmadi"
            message="Tanlangan filtr bo'yicha qarz topilmadi."
          />
        ) : (
          <>
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((debt, index) => (
                <li
                  key={debt.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <DebtRow
                    debt={debt}
                    onPay={() => setPaying(debt)}
                    onExtend={() => setExtending(debt)}
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

      <DebtPayDialog
        debt={paying}
        open={paying !== null}
        onOpenChange={(open) => !open && setPaying(null)}
      />
      <DebtExtendDialog
        debt={extending}
        open={extending !== null}
        onOpenChange={(open) => !open && setExtending(null)}
      />
    </PageContainer>
  );
}

function SummaryTile({
  label,
  amount,
  count,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  amount: number;
  count?: number;
  icon: typeof Wallet;
  tone: "primary" | "info" | "warning" | "danger";
  active: boolean;
  onClick: () => void;
}) {
  const tones = {
    primary: { chip: "bg-primary/12", icon: "text-primary" },
    info: { chip: "bg-info/12", icon: "text-info" },
    warning: { chip: "bg-warning/15", icon: "text-warning" },
    danger: { chip: "bg-danger/12", icon: "text-danger" },
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "bg-surface rounded-lg border p-5 text-left shadow-sm transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active
          ? "border-primary/50 bg-primary-soft/30"
          : "border-border hover:bg-surface-hover",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-label-sm text-text-secondary min-w-0 flex-1 truncate">
          {label}
        </span>
        <span
          className={cn(
            "flex size-[34px] items-center justify-center rounded-sm",
            tones[tone].chip,
          )}
          aria-hidden
        >
          <Icon className={cn("size-[18px]", tones[tone].icon)} />
        </span>
      </div>
      <p className="text-headline tabular mt-3">{money.plain(amount)}</p>
      {count !== undefined && (
        <p className="text-caption text-text-tertiary mt-1">{count} ta</p>
      )}
    </button>
  );
}

function DebtRow({
  debt,
  onPay,
  onExtend,
}: {
  debt: Debt;
  onPay: () => void;
  onExtend: () => void;
}) {
  const source = debtSourceRef(debt);
  const payable = isDebtPayable(debt);
  const overdue = debt.isOverdue && payable;

  return (
    // A debt past its date is marked on the row itself, the way an out-of-stock
    // shelf and an overdue visit are: the point of this page is to find those
    // rows while scrolling, not to read every date.
    <div
      className={cn(
        "flex items-center gap-3 border-l-[3px] px-5 py-3.5 transition-colors",
        overdue ? "border-l-danger bg-danger/6" : "border-l-transparent",
      )}
    >
      <AppAvatar
        name={debt.client?.fullName ?? "Mijoz"}
        imageUrl={debt.client?.avatarUrl}
        size={38}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {debt.client ? (
            <Link
              href={clientDetailPath(debt.client.id)}
              className="text-title-sm focus-visible:ring-ring truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {debt.client.fullName || "Mijoz"}
            </Link>
          ) : (
            <span className="text-title-sm truncate">Mijoz</span>
          )}
          <DebtStatusBadge debt={debt} />
          <DueDateBadge debt={debt} />
        </div>
        <p className="text-caption text-text-tertiary tabular mt-0.5 truncate">
          {debt.client?.phone ? phoneFromApi(debt.client.phone) : ""}
          {source ? ` · ${debtSourceLabel(source)}` : ""}
          {` · ${dayMonthYear(debt.dueDate)}`}
        </p>
      </div>

      <div className="hidden w-32 shrink-0 text-right sm:block">
        <p className="text-caption text-text-tertiary">To&rsquo;langan</p>
        <p className="text-title-sm tabular">{money.plain(debt.paidAmount)}</p>
      </div>

      <div className="w-32 shrink-0 text-right">
        <p className="text-caption text-text-tertiary">Qoldiq</p>
        <p
          className={cn(
            "text-title tabular",
            debt.isOverdue ? "text-danger" : "text-text-primary",
          )}
        >
          {money.plain(debt.remaining)}
        </p>
      </div>

      <div className="flex shrink-0 gap-1">
        {payable && (
          <>
            <Button size="sm" onClick={onPay}>
              <HandCoins className="size-4" aria-hidden />
              To&rsquo;lash
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onExtend}
              aria-label="Muddatni uzaytirish"
              className="text-text-secondary"
            >
              <CalendarPlus className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
