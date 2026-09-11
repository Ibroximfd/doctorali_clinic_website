"use client";

import { CalendarPlus, CalendarX2, UserSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ClientSearchField } from "@/features/clients/components/client-search-field";
import { clientDetailPath } from "@/config/routes";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { FilterBar, FilterSelect } from "@/shared/components/data-display/filter-bar";
import { DoctorFilter } from "@/features/doctors/components/doctor-filter";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import type { DateRange } from "@/shared/domain/date-range";
import { resolveRange } from "@/shared/domain/date-range";
import { activeRangeLabel, isSingleDay } from "@/shared/domain/date-range-label";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { addDays } from "@/shared/lib/format/date";
import { phoneToApi } from "@/shared/lib/format/phone";

import type { AppointmentFilter } from "../api/appointments-api";
import { useAppointmentsQuery } from "../hooks/use-appointments";
import {
  APPOINTMENT_PURPOSES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABEL,
  PURPOSE_LABEL,
  VISIT_TYPE_LABEL,
  type AppointmentPurpose,
  type AppointmentStatus,
  type VisitType,
} from "../types/appointment";
import { AppointmentDialogsProvider, useAppointmentDialogs } from "./appointment-dialogs";
import { AppointmentRow } from "./appointment-row";
import { AppointmentTableRow, AppointmentsTableHeader } from "./appointment-table-row";
import { TodayAppointmentsCard } from "./today-appointments-card";

const PAGE_SIZE = 20;

/** "Tashriflar" — today's queue on top, the searchable history under it. */
export function AppointmentsView() {
  return (
    <AppointmentDialogsProvider>
      <AppointmentsBody />
    </AppointmentDialogsProvider>
  );
}

function AppointmentsBody() {
  const dialogs = useAppointmentDialogs();
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 63.98rem)");

  // Today by default: the list is a working queue first and an archive second.
  const [range, setRange] = useState<DateRange | null>(() => resolveRange("daily"));
  const [status, setStatus] = useState<AppointmentStatus | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<AppointmentPurpose | null>(null);
  const [visitType, setVisitType] = useState<VisitType | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  /*
   * One day goes out as `date=`, a span as `date_from`/`date_to` — the backend
   * has both, and a queue that could only ever show ONE day meant answering
   * "kim shu hafta keladi?" by clicking through seven of them.
   */
  const filter = useMemo<AppointmentFilter>(
    () => ({
      ...(range && isSingleDay(range)
        ? { date: range.start }
        : range
          ? { dateFrom: range.start, dateTo: addDays(range.end, -1) }
          : {}),
      status,
      doctorId,
      purpose,
      visitType,
      search: debouncedSearch,
    }),
    [range, status, doctorId, purpose, visitType, debouncedSearch],
  );

  const list = useAppointmentsQuery(filter, page);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      {/* Search first: reception's day starts with someone walking in, not
          with the filter bar. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[260px] flex-1 space-y-1.5">
          <label
            htmlFor="appointment-client-search"
            className="text-label-sm text-text-secondary flex items-center gap-1.5"
          >
            <UserSearch className="text-primary size-4" aria-hidden />
            Mijozni topish
          </label>
          <ClientSearchField
            id="appointment-client-search"
            placeholder="Telefon yoki ism bo'yicha qidirish…"
            onSelect={(client) => router.push(clientDetailPath(client.id))}
            emptyAction={{
              label: "Yangi tashrif yaratish",
              onSelect: (query) => {
                const digits = query.replace(/\D/g, "");
                dialogs.openCreate(
                  digits.length >= 7 ? { phone: phoneToApi(query) } : { name: query },
                );
              },
            }}
          />
        </div>
        <Button onClick={() => dialogs.openCreate()} className="h-[46px]">
          <CalendarPlus className="size-4" aria-hidden />
          Yangi tashrif
        </Button>
      </div>

      <TodayAppointmentsCard showAllLink={false} />

      <FilterBar
        extraCount={[doctorId, purpose, visitType].filter((v) => v !== null).length}
        extra={
          <>
            <DoctorFilter value={doctorId} onChange={reset(setDoctorId)} />
            <FilterSelect
              label="Maqsad"
              value={purpose}
              onChange={reset(setPurpose)}
              options={APPOINTMENT_PURPOSES.map((option) => ({
                value: option,
                label: PURPOSE_LABEL[option],
              }))}
              allLabel="Barcha maqsadlar"
              width="w-[180px]"
            />
            <FilterSelect
              label="Tashrif turi"
              value={visitType}
              onChange={reset(setVisitType)}
              options={[
                { value: "scheduled" as const, label: VISIT_TYPE_LABEL.scheduled },
                { value: "walk_in" as const, label: VISIT_TYPE_LABEL.walk_in },
              ]}
              allLabel="Barcha tashriflar"
              width="w-[180px]"
            />
          </>
        }
        action={
          <span className="text-caption text-text-tertiary tabular">
            Jami {list.data?.count ?? 0} ta tashrif
          </span>
        }
      >
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Mijoz ismi yoki telefon…"
          className="w-full sm:w-[260px]"
        />
        <DateFilter value={range} onChange={reset(setRange)} />
        <FilterSelect
          label="Holat"
          value={status}
          onChange={reset(setStatus)}
          options={APPOINTMENT_STATUSES.map((option) => ({
            value: option,
            label: APPOINTMENT_STATUS_LABEL[option],
          }))}
          allLabel="Barcha holatlar"
          width="w-[180px]"
        />
      </FilterBar>

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
          ...(status
            ? [
                {
                  id: "status",
                  label: APPOINTMENT_STATUS_LABEL[status],
                  onClear: () => reset(setStatus)(null),
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
          ...(purpose
            ? [
                {
                  id: "purpose",
                  label: PURPOSE_LABEL[purpose],
                  onClear: () => reset(setPurpose)(null),
                },
              ]
            : []),
          ...(visitType
            ? [
                {
                  id: "visitType",
                  label: VISIT_TYPE_LABEL[visitType],
                  onClear: () => reset(setVisitType)(null),
                },
              ]
            : []),
        ]}
        onClearAll={() => {
          setRange(null);
          setStatus(null);
          setDoctorId(null);
          setPurpose(null);
          setVisitType(null);
          setPage(1);
        }}
      />

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={60} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={CalendarX2}
            title="Hech narsa topilmadi"
            message="Tanlangan filtr bo'yicha tashriflar mavjud emas."
            action={
              <Button variant="outline" onClick={() => dialogs.openCreate()}>
                <CalendarPlus className="size-4" aria-hidden />
                Yangi tashrif
              </Button>
            }
          />
        ) : (
          <>
            {!isMobile && <AppointmentsTableHeader />}
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((appointment, index) => (
                <li
                  key={appointment.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  {isMobile ? (
                    <AppointmentRow appointment={appointment} showDate />
                  ) : (
                    <AppointmentTableRow appointment={appointment} />
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
    </PageContainer>
  );
}
