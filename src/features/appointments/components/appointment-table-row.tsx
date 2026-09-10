"use client";

import Link from "next/link";

import { clientDetailPath } from "@/config/routes";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { useMinuteTick } from "@/shared/hooks/use-minute-tick";
import { hhmm, nowTashkent, shortDate } from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { cn } from "@/shared/lib/utils";

import { appointmentPurposeLabel, isDueAt, type Appointment } from "../types/appointment";
import { AppointmentActionsMenu } from "./appointment-actions-menu";
import { useAppointmentDialogs } from "./appointment-dialogs";
import { AppointmentStatusChip } from "./appointment-status-chip";

/** Column widths, shared by the header and the rows so they line up. */
export const APPOINTMENT_GRID =
  "grid grid-cols-[110px_minmax(0,1.4fr)_120px_minmax(0,1fr)_140px_44px] items-center gap-3 px-5";

export function AppointmentsTableHeader() {
  return (
    <div
      className={cn(APPOINTMENT_GRID, "border-border bg-surface-alt/40 border-b py-3")}
    >
      {["Vaqt", "Mijoz", "Maqsad", "Shifokor", "Holat", ""].map((label, i) => (
        <span key={label || i} className="text-label-xs text-text-tertiary uppercase">
          {label}
        </span>
      ))}
    </div>
  );
}

/** One visit as a desktop table row. */
export function AppointmentTableRow({ appointment }: { appointment: Appointment }) {
  const dialogs = useAppointmentDialogs();
  const busy = dialogs.busyIds.has(appointment.id);

  const pending =
    appointment.status === "scheduled" && !isDueAt(appointment, nowTashkent());
  useMinuteTick(pending);
  const due = isDueAt(appointment, nowTashkent());

  return (
    <div
      className={cn(
        APPOINTMENT_GRID,
        "border-l-[3px] py-3 transition-colors",
        due ? "border-l-warning bg-warning/10" : "border-l-transparent",
        busy && "pointer-events-none opacity-55",
      )}
      aria-busy={busy}
    >
      <button
        type="button"
        onClick={() => dialogs.openDetail(appointment)}
        className="focus-visible:ring-ring rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
      >
        <span className="text-title-sm tabular block">
          {hhmm(appointment.scheduledAt)}
        </span>
        <span className="text-caption text-text-tertiary tabular block">
          {shortDate(appointment.scheduledAt)}
        </span>
      </button>

      <div className="flex min-w-0 items-center gap-2.5">
        <AppAvatar
          name={appointment.clientName || "Mijoz"}
          imageUrl={appointment.client?.avatarUrl ?? null}
          size={32}
        />
        <div className="min-w-0">
          {appointment.client && appointment.client.id > 0 ? (
            <Link
              href={clientDetailPath(appointment.client.id)}
              className="text-title-sm focus-visible:ring-ring block truncate rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {appointment.clientName || "Mijoz"}
            </Link>
          ) : (
            <span className="text-title-sm block truncate">
              {appointment.clientName || "Mijoz"}
            </span>
          )}
          <span className="text-caption text-text-tertiary tabular block truncate">
            {phoneFromApi(appointment.clientPhone)}
          </span>
        </div>
      </div>

      <span className="text-body-sm text-text-secondary truncate">
        {appointmentPurposeLabel(appointment)}
      </span>

      {appointment.doctor ? (
        <div className="flex min-w-0 items-center gap-2">
          <AppAvatar
            name={appointment.doctor.fullName}
            imageUrl={appointment.doctor.avatarUrl}
            size={26}
          />
          <span className="text-body-sm truncate">{appointment.doctor.fullName}</span>
        </div>
      ) : (
        <span className="text-body-sm text-text-tertiary">—</span>
      )}

      <AppointmentStatusChip
        status={appointment.status}
        statusDisplay={appointment.statusDisplay}
        className="justify-self-start"
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
