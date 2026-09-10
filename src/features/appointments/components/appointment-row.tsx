"use client";

import { cn } from "@/shared/lib/utils";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { hhmm, nowTashkent, shortDate } from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { useMinuteTick } from "@/shared/hooks/use-minute-tick";

import { appointmentPurposeLabel, isDueAt, type Appointment } from "../types/appointment";
import { AppointmentActionsMenu } from "./appointment-actions-menu";
import { useAppointmentDialogs } from "./appointment-dialogs";
import { AppointmentStatusChip } from "./appointment-status-chip";

/**
 * One visit, as a row.
 *
 * A scheduled visit whose time has come is marked — a warm left edge — because
 * that is the row reception has to do something about: the client is late, or
 * standing at the desk unrecorded.
 */
export function AppointmentRow({
  appointment,
  showDate = false,
}: {
  appointment: Appointment;
  /** The full list spans days, so it prints the date; today's queue doesn't. */
  showDate?: boolean;
}) {
  const dialogs = useAppointmentDialogs();
  const busy = dialogs.busyIds.has(appointment.id);

  // Only a scheduled visit still ahead of its slot has a transition left to
  // catch; everything else is already in its final look.
  const pending =
    appointment.status === "scheduled" && !isDueAt(appointment, nowTashkent());
  useMinuteTick(pending);

  const due = isDueAt(appointment, nowTashkent());

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => dialogs.openDetail(appointment)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          dialogs.openDetail(appointment);
        }
      }}
      aria-busy={busy}
      className={cn(
        "flex w-full items-center gap-3 border-l-[3px] px-3 py-2.5 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        due
          ? "border-l-warning bg-warning/10 hover:bg-warning/16"
          : "hover:bg-surface-hover border-l-transparent",
        busy && "pointer-events-none opacity-55",
      )}
    >
      <span className="bg-surface-alt flex size-10 shrink-0 flex-col items-center justify-center rounded-md">
        <span className="text-label-sm tabular">{hhmm(appointment.scheduledAt)}</span>
        {showDate && (
          <span className="text-text-tertiary tabular text-[10px]">
            {shortDate(appointment.scheduledAt)}
          </span>
        )}
      </span>

      {appointment.doctor && (
        <AppAvatar
          name={appointment.doctor.fullName}
          imageUrl={appointment.doctor.avatarUrl}
          size={28}
          className="hidden sm:flex"
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="text-title-sm block truncate">{appointment.clientName}</span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {[
            phoneFromApi(appointment.clientPhone),
            appointmentPurposeLabel(appointment),
            appointment.doctor?.fullName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>

      <AppointmentStatusChip
        status={appointment.status}
        statusDisplay={appointment.statusDisplay}
        className="shrink-0"
      />

      <AppointmentActionsMenu
        appointment={appointment}
        disabled={busy}
        onSelect={(action) => {
          if (action === "arrived") dialogs.openArrived(appointment);
          else if (action === "edit") dialogs.openEdit(appointment);
          else dialogs.openCancel(appointment);
        }}
      />
    </div>
  );
}
