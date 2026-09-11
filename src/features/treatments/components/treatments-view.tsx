"use client";

import { Activity, Ban, Plus, Stethoscope } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { clientDetailPath } from "@/config/routes";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DoctorFilter } from "@/features/doctors/components/doctor-filter";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { FilterBar, FilterSelect } from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { StatCard } from "@/shared/components/data-display/stat-card";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { ReasonDialog } from "@/shared/components/feedback/reason-dialog";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { resolveRange, type DateRange } from "@/shared/domain/date-range";
import { activeRangeLabel } from "@/shared/domain/date-range-label";
import {
  MIXED_PAYMENT_LABEL,
  NO_PAYMENT_LABEL,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { dayMonthTime, isToday } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";
import { cn } from "@/shared/lib/utils";

import type { TreatmentFilter } from "../api/treatments-api";
import {
  useCancelTreatment,
  useTreatmentSummaryQuery,
  useTreatmentsQuery,
} from "../hooks/use-treatments";
import {
  TREATMENT_KIND_LABEL,
  TREATMENT_STATUS_LABEL,
  averageTreatmentAmount,
  treatmentClientName,
  treatmentKindLabel,
  type Treatment,
  type TreatmentKind,
  type TreatmentStatus,
} from "../types/treatment";
import { TreatmentFormDialog } from "./treatment-form-dialog";

const PAGE_SIZE = 20;

/** "Muolajalar" — the services performed, and what each earned the doctor. */
export function TreatmentsView() {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<TreatmentKind | null>(null);
  // Opens on today, like the orders list: the day's services are what the desk
  // checks, and the whole history is one ✕ away on the filter chip.
  const [range, setRange] = useState<DateRange | null>(() => resolveRange("daily"));
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [status, setStatus] = useState<TreatmentStatus | null>(null);
  const [hasDebt, setHasDebt] = useState<"yes" | "no" | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Treatment | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const pinGate = usePinGate();
  const cancel = useCancelTreatment();

  const filter = useMemo<TreatmentFilter>(
    () => ({
      search: debouncedSearch,
      kind,
      range,
      doctorId,
      paymentType,
      status,
      hasDebt: hasDebt === null ? null : hasDebt === "yes",
      ordering: "-performed_at",
    }),
    [debouncedSearch, kind, range, doctorId, paymentType, status, hasDebt],
  );

  const list = useTreatmentsQuery(filter, page);
  const summary = useTreatmentSummaryQuery(filter);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  /**
   * Cancelling a service from an earlier day is an out-of-today change, so it
   * goes through the PIN gate exactly like a backdated write does.
   */
  function confirmCancel(reason: string) {
    const treatment = cancelling;
    if (!treatment) return;
    setCancelling(null);
    const run = (pin?: string) =>
      cancel.mutate({ id: treatment.id, reason, confirmPin: pin ?? null });
    if (isToday(treatment.performedAt)) run();
    else pinGate.requestPin((pin) => run(pin));
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      {summary.data && summary.data.totalCount > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Jami xizmatlar"
            value={String(summary.data.totalCount)}
            icon={Activity}
            tone="primary"
            hint={`Muolaja ${summary.data.treatmentsCount} · Konsultatsiya ${summary.data.consultationsCount}`}
          />
          <StatCard
            label="Jami summa"
            value={money.plain(summary.data.totalAmount)}
            icon={Stethoscope}
            tone="info"
            hint={`O'rtacha ${money.plain(averageTreatmentAmount(summary.data))}`}
          />
          <StatCard
            label="Komissiya"
            value={money.plain(summary.data.totalCommission)}
            icon={Stethoscope}
            tone="gold"
          />
          <StatCard
            label="Qarzda"
            value={money.plain(summary.data.debtAmount)}
            icon={Activity}
            tone={summary.data.debtAmount > 0 ? "warning" : "neutral"}
          />
        </div>
      )}

      <FilterBar
        extraCount={
          [doctorId, paymentType, status, hasDebt].filter((v) => v !== null).length
        }
        extra={
          <>
            <DoctorFilter value={doctorId} onChange={reset(setDoctorId)} />
            <FilterSelect
              label="To'lov turi"
              value={paymentType}
              onChange={reset(setPaymentType)}
              options={PAYMENT_TYPES.map((type) => ({
                value: type,
                label: PAYMENT_TYPE_LABEL[type],
              }))}
              allLabel="Barcha to'lovlar"
            />
            <FilterSelect
              label="Qarz"
              value={hasDebt}
              onChange={reset(setHasDebt)}
              options={[
                { value: "yes" as const, label: "Qarzli" },
                { value: "no" as const, label: "Qarzsiz" },
              ]}
              allLabel="Qarzi bor-yo'q"
              width="w-[150px]"
            />
            <FilterSelect
              label="Holat"
              value={status}
              onChange={reset(setStatus)}
              options={[
                { value: "completed" as const, label: TREATMENT_STATUS_LABEL.completed },
                { value: "cancelled" as const, label: TREATMENT_STATUS_LABEL.cancelled },
              ]}
              allLabel="Barcha holatlar"
              width="w-[170px]"
            />
          </>
        }
        action={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Yangi muolaja
          </Button>
        }
      >
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Mijoz, telefon yoki tavsif…"
          className="w-full sm:w-[260px]"
        />
        <DateFilter value={range} onChange={reset(setRange)} />
        <FilterSelect
          label="Xizmat turi"
          value={kind}
          onChange={reset(setKind)}
          options={[
            { value: "treatment" as const, label: TREATMENT_KIND_LABEL.treatment },
            { value: "consultation" as const, label: TREATMENT_KIND_LABEL.consultation },
          ]}
          allLabel="Barcha turlar"
          width="w-[180px]"
        />
      </FilterBar>

      {/* The day the list is showing, with the ✕ that opens the whole history
          — the filter is on by default now, so it must be visibly removable. */}
      <ActiveFilters
        filters={[
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
          ...(kind
            ? [
                {
                  id: "kind",
                  label: TREATMENT_KIND_LABEL[kind],
                  onClear: () => reset(setKind)(null),
                },
              ]
            : []),
          ...(doctorId
            ? [
                {
                  id: "doctor",
                  label: "Shifokor tanlangan",
                  onClear: () => reset(setDoctorId)(null),
                },
              ]
            : []),
          ...(paymentType
            ? [
                {
                  id: "payment",
                  label: PAYMENT_TYPE_LABEL[paymentType],
                  onClear: () => reset(setPaymentType)(null),
                },
              ]
            : []),
          ...(hasDebt
            ? [
                {
                  id: "debt",
                  label: hasDebt === "yes" ? "Qarzli" : "Qarzsiz",
                  onClear: () => reset(setHasDebt)(null),
                },
              ]
            : []),
          ...(status
            ? [
                {
                  id: "status",
                  label: TREATMENT_STATUS_LABEL[status],
                  onClear: () => reset(setStatus)(null),
                },
              ]
            : []),
        ]}
        onClearAll={() => {
          setKind(null);
          setRange(null);
          setDoctorId(null);
          setPaymentType(null);
          setStatus(null);
          setHasDebt(null);
          setPage(1);
        }}
      />

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={70} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Muolaja topilmadi"
            message="Tanlangan filtr bo'yicha yozuv yo'q."
          />
        ) : (
          <>
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((treatment, index) => (
                <li
                  key={treatment.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <TreatmentRow
                    treatment={treatment}
                    onCancel={() => setCancelling(treatment)}
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

      <TreatmentFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        description="Oldingi kundagi muolajani bekor qilish uchun PIN-kodni kiriting."
      />

      <ReasonDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        onConfirm={confirmCancel}
        busy={cancel.isPending}
        title="Muolajani bekor qilish"
        description={
          cancelling
            ? `${treatmentClientName(cancelling)} · ${money.uzs(cancelling.amount)}`
            : undefined
        }
        confirmLabel="Bekor qilish"
      />
    </PageContainer>
  );
}

function TreatmentRow({
  treatment,
  onCancel,
}: {
  treatment: Treatment;
  onCancel: () => void;
}) {
  const cancelled = treatment.status === "cancelled";

  return (
    <div className={cn("flex items-center gap-3 px-5 py-3.5", cancelled && "opacity-60")}>
      <AppAvatar
        name={treatmentClientName(treatment)}
        imageUrl={treatment.client?.avatarUrl}
        size={38}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {treatment.client ? (
            <Link
              href={clientDetailPath(treatment.client.id)}
              className={cn(
                "text-title-sm truncate rounded-sm hover:underline",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                cancelled && "line-through",
              )}
            >
              {treatmentClientName(treatment)}
            </Link>
          ) : (
            <span className={cn("text-title-sm truncate", cancelled && "line-through")}>
              {treatmentClientName(treatment)}
            </span>
          )}
          <span
            className={cn(
              "text-label-xs shrink-0 rounded-full px-2 py-0.5",
              treatment.kind === "consultation"
                ? "bg-info/12 text-info"
                : "bg-primary-soft text-primary-dark",
            )}
          >
            {treatmentKindLabel(treatment)}
          </span>
          {cancelled && (
            <span className="bg-danger/12 text-label-xs text-danger shrink-0 rounded-full px-2 py-0.5">
              Bekor qilingan
            </span>
          )}
          {treatment.debt && (
            <span className="bg-warning/15 text-label-xs text-warning shrink-0 rounded-full px-2 py-0.5">
              Qarz {money.plain(treatment.debt.remaining)}
            </span>
          )}
        </div>
        <p className="text-caption text-text-tertiary mt-0.5 truncate">
          {treatment.description || "Tavsif yo'q"} ·{" "}
          {treatment.doctor?.fullName ?? "Shifokor yo'q"} ·{" "}
          {dayMonthTime(treatment.performedAt)}
        </p>
      </div>

      <div className="hidden w-28 shrink-0 text-right sm:block">
        <p className="text-caption text-text-tertiary">Komissiya</p>
        <p className="text-title-sm tabular">
          {money.plain(treatment.commissionAmount)}
          <span className="text-caption text-text-tertiary ml-1 font-normal">
            {percent.labeled(treatment.commissionPercent)}
          </span>
        </p>
      </div>

      <div className="w-32 shrink-0 text-right">
        <p className="text-caption text-text-tertiary">
          {treatment.isMixedPayment
            ? MIXED_PAYMENT_LABEL
            : treatment.paymentType
              ? PAYMENT_TYPE_LABEL[treatment.paymentType]
              : NO_PAYMENT_LABEL}
        </p>
        <p className="text-title tabular">{money.plain(treatment.amount)}</p>
      </div>

      {!cancelled && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Amallar" className="shrink-0">
              <span aria-hidden className="text-lg leading-none">
                ⋯
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCancel} className="text-danger">
              <Ban className="size-4" aria-hidden />
              Bekor qilish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
