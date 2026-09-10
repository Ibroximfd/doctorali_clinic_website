"use client";

import { CalendarPlus, CalendarX2, UserSearch } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ClientSearchField } from "@/features/clients/components/client-search-field";
import { clientDetailPath } from "@/config/routes";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { AppCard } from "@/shared/components/data-display/app-card";
import { DateInput } from "@/shared/components/form/date-input";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import {
  nowTashkent,
  shortDate,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { phoneToApi } from "@/shared/lib/format/phone";

import type { AppointmentFilter } from "../api/appointments-api";
import { useAppointmentsQuery } from "../hooks/use-appointments";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
} from "../types/appointment";
import { AppointmentDialogsProvider, useAppointmentDialogs } from "./appointment-dialogs";
import { AppointmentRow } from "./appointment-row";
import { AppointmentTableRow, AppointmentsTableHeader } from "./appointment-table-row";
import { TodayAppointmentsCard } from "./today-appointments-card";

const PAGE_SIZE = 20;
const ALL = "__all__";

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
  const [date, setDate] = useState<TashkentDate | null>(() => startOfDay(nowTashkent()));
  const [status, setStatus] = useState<AppointmentStatus | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);

  const filter = useMemo<AppointmentFilter>(
    () => ({ date, status, search: debouncedSearch }),
    [date, status, debouncedSearch],
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

      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Mijoz ismi yoki telefon…"
          className="w-full sm:w-[280px]"
        />

        <DateInput
          value={date}
          onChange={reset(setDate)}
          placeholder="Barcha sanalar"
          className="h-[38px]"
        />

        <Select
          value={status ?? ALL}
          onValueChange={reset((value: string) =>
            setStatus(value === ALL ? null : (value as AppointmentStatus)),
          )}
        >
          <SelectTrigger className="h-[38px] w-[180px]">
            <SelectValue placeholder="Barcha holatlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Barcha holatlar</SelectItem>
            {APPOINTMENT_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {APPOINTMENT_STATUS_LABEL[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-caption text-text-tertiary tabular ml-auto">
          Jami {list.data?.count ?? 0} ta tashrif
        </span>
      </div>

      <ActiveFilters
        filters={[
          ...(date
            ? [
                {
                  id: "date",
                  label: shortDate(date),
                  onClear: () => reset(setDate)(null),
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
        ]}
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
