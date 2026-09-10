"use client";

import { Ban, ChevronRight, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ReasonDialog } from "@/shared/components/feedback/reason-dialog";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { dayMonth, dayMonthYear, ymd } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { PayoutFilter } from "../api/payouts-api";
import {
  useCancelPayout,
  useOutstandingQuery,
  usePayoutsQuery,
} from "../hooks/use-payouts";
import { PAYOUT_STATUS_LABEL, balanceOf, type Payout } from "../types/payout";
import { WeekDetailDialog } from "./week-detail-dialog";

const PAGE_SIZE = 20;

/** "To'lovlar" — weekly doctor commissions: what is owed, and what was paid. */
export function PayoutsView() {
  const [tab, setTab] = useState<"outstanding" | "history">("outstanding");
  const [week, setWeek] = useState<{
    doctorId: string;
    weekStart: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState<Payout | null>(null);
  const [page, setPage] = useState(1);

  const outstanding = useOutstandingQuery();
  const filter = useMemo<PayoutFilter>(() => ({}), []);
  const history = usePayoutsQuery(filter, page);
  const cancel = useCancelPayout();

  return (
    <PageContainer className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
        <TabsList>
          <TabsTrigger value="outstanding">To&rsquo;lanmagan</TabsTrigger>
          <TabsTrigger value="history">Tarix</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "outstanding" ? (
        outstanding.error && !outstanding.data ? (
          <AppCard padded={false}>
            <ErrorState
              error={outstanding.error}
              onRetry={() => void outstanding.refetch()}
            />
          </AppCard>
        ) : outstanding.isPending || !outstanding.data ? (
          <AppCard padded={false}>
            <ListSkeleton rows={4} height={120} />
          </AppCard>
        ) : outstanding.data.doctors.length === 0 ? (
          <AppCard padded={false}>
            <EmptyState
              icon={Wallet}
              title="Hammasi to'langan"
              message="Barcha tugagan haftalar to'langan."
            />
          </AppCard>
        ) : (
          <>
            <AppCard className="flex items-baseline gap-3">
              <span className="text-label text-text-secondary flex-1">
                Jami to&rsquo;lanmagan
              </span>
              <span className="text-display-sm tabular">
                {money.plain(outstanding.data.grandTotal)}
              </span>
            </AppCard>

            <div className="flex flex-col gap-4">
              {outstanding.data.doctors.map((entry) => (
                <AppCard key={entry.doctor.id}>
                  <SectionHeader
                    title={entry.doctor.fullName}
                    subtitle={`${entry.weeksCount} ta hafta · ${entry.doctor.specialty || "Mutaxassislik ko'rsatilmagan"}`}
                    actions={
                      <span className="text-title-lg tabular">
                        {money.plain(entry.totalUnpaid)}
                      </span>
                    }
                  />
                  <ul className="mt-4 flex flex-col gap-2">
                    {entry.weeks.map((w) => {
                      const balance = balanceOf(w.totalAmount);
                      return (
                        <li key={w.weekStart.getTime()}>
                          <button
                            type="button"
                            onClick={() =>
                              setWeek({
                                doctorId: String(entry.doctor.id),
                                weekStart: ymd(w.weekStart),
                              })
                            }
                            className={cn(
                              "border-border flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left",
                              "hover:border-primary/40 hover:bg-surface-hover transition-colors",
                              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="text-title-sm block">
                                {dayMonth(w.weekStart)} – {dayMonthYear(w.weekEnd)}
                              </span>
                              <span className="text-caption text-text-tertiary block">
                                {w.commissionCount} ta komissiya
                              </span>
                            </span>
                            <span
                              className={cn(
                                "text-title tabular shrink-0",
                                balance === "owed_by_doctor" && "text-danger",
                              )}
                            >
                              {money.plain(w.totalAmount)}
                            </span>
                            <ChevronRight
                              className="text-text-tertiary size-4 shrink-0"
                              aria-hidden
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </AppCard>
              ))}
            </div>
          </>
        )
      ) : (
        <AppCard padded={false} className="overflow-hidden">
          {history.error && !history.data ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : history.isPending || !history.data ? (
            <ListSkeleton rows={8} height={66} />
          ) : history.data.results.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="To'lov yo'q"
              message="Tanlangan filtr bo'yicha to'lov yo'q."
            />
          ) : (
            <>
              <ul>
                {history.data.results.map((payout, index) => (
                  <li
                    key={payout.id}
                    className={index > 0 ? "border-surface-alt border-t" : undefined}
                  >
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <AppAvatar
                        name={payout.doctor.fullName}
                        imageUrl={payout.doctor.avatarUrl}
                        size={38}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-title-sm truncate">{payout.doctor.fullName}</p>
                        <p className="text-caption text-text-tertiary truncate">
                          {dayMonth(payout.weekStart)} – {dayMonthYear(payout.weekEnd)}
                          {payout.paidByName && ` · ${payout.paidByName}`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-label-xs shrink-0 rounded-full px-2 py-0.5",
                          payout.status === "paid"
                            ? "bg-primary-soft text-primary-dark"
                            : "bg-danger/12 text-danger",
                        )}
                      >
                        {PAYOUT_STATUS_LABEL[payout.status]}
                      </span>
                      <span className="text-title tabular w-32 shrink-0 text-right">
                        {money.plain(payout.totalAmount)}
                      </span>
                      {payout.status === "paid" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCancelling(payout)}
                          aria-label="To'lovni bekor qilish"
                          className="text-text-secondary hover:text-danger shrink-0"
                        >
                          <Ban className="size-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <PaginationBar
                page={page}
                pageSize={PAGE_SIZE}
                total={history.data.count}
                onPageChange={setPage}
                busy={history.isFetching}
              />
            </>
          )}
        </AppCard>
      )}

      <WeekDetailDialog
        doctorId={week?.doctorId ?? null}
        weekStart={week?.weekStart ?? null}
        open={week !== null}
        onOpenChange={(open) => !open && setWeek(null)}
      />

      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        busy={cancel.isPending}
        title="To'lovni bekor qilish"
        description={
          cancelling
            ? `${cancelling.doctor.fullName} · ${money.uzs(cancelling.totalAmount)}. Hafta yana to'lanmaganlar ro'yxatiga qaytadi.`
            : undefined
        }
        confirmLabel="Bekor qilish"
        onConfirm={(reason) => {
          const payout = cancelling;
          setCancelling(null);
          if (payout) cancel.mutate({ id: payout.id, reason });
        }}
      />
    </PageContainer>
  );
}
