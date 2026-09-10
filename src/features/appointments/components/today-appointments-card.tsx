"use client";

import { CalendarCheck, CalendarPlus, CalendarX2 } from "lucide-react";
import Link from "next/link";

import { AppRoutes } from "@/config/routes";
import { AppCard } from "@/shared/components/data-display/app-card";
import { SectionHeader } from "@/shared/components/data-display/section-header";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { hhmm } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import { useTodayAppointmentsQuery } from "../hooks/use-appointments";
import type { AppointmentCounts, DoctorQueueCount } from "../types/appointment";
import { AppointmentRow } from "./appointment-row";
import { useAppointmentDialogs } from "./appointment-dialogs";

/**
 * Today's queue.
 *
 * "Kutilmoqda" leads every other number here because it is the only one about
 * right now: how many people are sitting in the waiting room. The rest describe
 * the day.
 */
export function TodayAppointmentsCard({
  showAllLink = true,
}: {
  /** Off on the appointments page itself, where "Barchasi" is the page below. */
  showAllLink?: boolean;
}) {
  const dialogs = useAppointmentDialogs();
  const { data, error, isPending, refetch } = useTodayAppointmentsQuery();

  return (
    <AppCard className="flex flex-col gap-3">
      <SectionHeader
        title="Bugungi tashriflar"
        icon={CalendarCheck}
        subtitle={
          data?.nextAppointmentAt
            ? `Keyingi mijoz — ${hhmm(data.nextAppointmentAt)}`
            : undefined
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Yangi tashrif"
              onClick={() => dialogs.openCreate()}
            >
              <CalendarPlus className="size-4" aria-hidden />
            </Button>
            {showAllLink && (
              <Button asChild variant="ghost" size="sm">
                <Link href={AppRoutes.appointments}>Barchasi</Link>
              </Button>
            )}
          </>
        }
      />

      {error && !data ? (
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="Tashriflarni yuklab bo'lmadi"
        />
      ) : isPending || !data ? (
        <TodaySkeleton />
      ) : data.results.length === 0 ? (
        <EmptyState
          title="Bugun tashriflar yo'q"
          message="Mijoz kelganda «Yangi tashrif» tugmasi bilan qayd eting."
          icon={CalendarX2}
          action={
            <Button variant="outline" onClick={() => dialogs.openCreate()}>
              <CalendarPlus className="size-4" aria-hidden />
              Yangi tashrif
            </Button>
          }
        />
      ) : (
        <>
          <CountsRow counts={data.counts} waitingCount={data.waitingCount} />
          {data.byDoctor.length > 0 && <DoctorQueueRow queues={data.byDoctor} />}
          <ul className="divide-border/60 -mx-2 divide-y">
            {data.results.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentRow appointment={appointment} />
              </li>
            ))}
          </ul>
        </>
      )}
    </AppCard>
  );
}

function CountsRow({
  counts,
  waitingCount,
}: {
  counts: AppointmentCounts;
  waitingCount: number;
}) {
  const badges: readonly { label: string; value: number; tone: string }[] = [
    ...(waitingCount > 0
      ? [
          {
            label: "Kutilmoqda",
            value: waitingCount,
            tone: "bg-primary/10 text-primary",
          },
        ]
      : []),
    {
      label: "Rejalashtirilgan",
      value: counts.scheduled,
      tone: "bg-info/10 text-info",
    },
    {
      label: "Keldi",
      value: counts.arrived,
      tone: "bg-success/10 text-success",
    },
    {
      label: "Kelmadi",
      value: counts.noShow,
      tone: "bg-warning/10 text-warning",
    },
    {
      label: "Bekor qilingan",
      value: counts.cancelled,
      tone: "bg-danger/10 text-danger",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={cn(
            "text-caption inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5",
            badge.tone,
          )}
        >
          <span className="size-2 rounded-full bg-current" aria-hidden />
          <span className="text-title-sm tabular">{badge.value}</span>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

/** Who is busy — read before promising a client a short wait. */
function DoctorQueueRow({ queues }: { queues: readonly DoctorQueueCount[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {queues.map((queue) => (
        <span
          key={queue.doctorId}
          className="border-border text-label-xs text-text-secondary inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
        >
          {queue.fullName}
          <span className="tabular text-text-primary">
            {queue.arrived + queue.scheduled}
          </span>
        </span>
      ))}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-[130px] rounded-md" />
        ))}
      </div>
      <div className="flex flex-col gap-px">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
