"use client";

import { BriefcaseMedical, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { doctorDetailPath } from "@/config/routes";
import type { StatsQuery } from "@/features/statistics/api/statistics-api";
import { useDoctorStatsQuery } from "@/features/statistics/hooks/use-dashboard";
import type { DoctorStat } from "@/features/statistics/types/statistics";
import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { PeriodSelector } from "@/shared/components/data-display/period-selector";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { StatPeriod } from "@/shared/domain/date-range";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { money } from "@/shared/lib/format/money";
import { percent } from "@/shared/lib/format/percent";

const ORDERINGS = [
  { value: "-revenue", label: "Ko'p savdo" },
  { value: "-commission_earned", label: "Ko'p komissiya" },
  { value: "-orders_count", label: "Ko'p buyurtma" },
  { value: "-units_sold", label: "Ko'p dona" },
] as const;

const PAGE_SIZE = 20;

/** "Shifokorlar" — who sold what, and what the clinic owes them for it. */
export function DoctorsView() {
  const [period, setPeriod] = useState<StatPeriod>("monthly");
  const [ordering, setOrdering] = useState<string>("-revenue");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search);
  const query = useMemo<StatsQuery>(() => ({ period }), [period]);

  const { data, error, isPending, isFetching, refetch } = useDoctorStatsQuery({
    query,
    ordering,
    search: debouncedSearch,
    page,
  });

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
          placeholder="Shifokor ismi…"
          className="w-full sm:w-[280px]"
        />
        <PeriodSelector value={period} onChange={reset(setPeriod)} granularity />
        <div className="flex-1" />
        <Select value={ordering} onValueChange={reset(setOrdering)}>
          <SelectTrigger className="w-[190px]" aria-label="Saralash">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDERINGS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {error && !data ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending || !data ? (
          <ListSkeleton rows={8} height={64} />
        ) : data.results.length === 0 ? (
          <EmptyState
            icon={BriefcaseMedical}
            title="Shifokor topilmadi"
            message="Filtrni o'zgartiring yoki qidiruvni tozalang."
          />
        ) : (
          <>
            <ul style={{ opacity: isFetching ? 0.6 : 1 }} aria-busy={isFetching}>
              {data.results.map((doctor, index) => (
                <li
                  key={doctor.doctorId}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <DoctorRow doctor={doctor} />
                </li>
              ))}
            </ul>
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={data.count}
              onPageChange={setPage}
              busy={isFetching}
            />
          </>
        )}
      </AppCard>
    </PageContainer>
  );
}

function DoctorRow({ doctor }: { doctor: DoctorStat }) {
  return (
    <Link
      href={doctorDetailPath(doctor.doctorId)}
      className="hover:bg-surface-hover focus-visible:ring-ring flex items-center gap-4 px-5 py-3.5 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
    >
      <AppAvatar name={doctor.fullName} imageUrl={doctor.avatarUrl} size={40} />

      <div className="min-w-0 flex-1">
        <p className="text-title-sm truncate">{doctor.fullName}</p>
        <p className="text-caption text-text-tertiary truncate">
          {doctor.specialty || "Mutaxassislik ko'rsatilmagan"}
        </p>
      </div>

      <div className="hidden w-24 text-right sm:block">
        <p className="text-caption text-text-tertiary">Buyurtma</p>
        <p className="text-title-sm tabular">{doctor.ordersCount}</p>
      </div>

      <div className="hidden w-28 text-right md:block">
        <p className="text-caption text-text-tertiary">Dona</p>
        <p className="text-title-sm tabular">{doctor.unitsSold}</p>
      </div>

      <div className="w-32 text-right">
        <p className="text-caption text-text-tertiary">Savdo</p>
        <p className="text-title-sm tabular">{money.plain(doctor.revenue)}</p>
      </div>

      <div className="w-32 text-right">
        <p className="text-caption text-text-tertiary">
          Komissiya · {percent.labeled(doctor.commissionPercent)}
        </p>
        <p className="text-title-sm text-primary-dark tabular">
          {money.plain(doctor.commissionEarned)}
        </p>
      </div>

      <ChevronRight className="text-text-tertiary size-4 shrink-0" aria-hidden />
    </Link>
  );
}
