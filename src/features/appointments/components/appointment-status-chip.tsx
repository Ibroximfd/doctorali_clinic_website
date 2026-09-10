import { CalendarClock, CheckCircle2, UserX, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import { APPOINTMENT_STATUS_LABEL, type AppointmentStatus } from "../types/appointment";

const ICON: Readonly<Record<AppointmentStatus, LucideIcon>> = {
  scheduled: CalendarClock,
  arrived: CheckCircle2,
  cancelled: XCircle,
  no_show: UserX,
};

const TONE: Readonly<Record<AppointmentStatus, string>> = {
  scheduled: "bg-info/12 text-info",
  arrived: "bg-success/12 text-success",
  cancelled: "bg-danger/12 text-danger",
  no_show: "bg-warning/12 text-warning",
};

/**
 * Status pill. The text is the backend's own Uzbek label when it sent one —
 * server display text is never re-translated locally — falling back to the
 * local label only where no specific appointment is in scope (a filter option).
 */
export function AppointmentStatusChip({
  status,
  statusDisplay,
  className,
}: {
  status: AppointmentStatus;
  statusDisplay?: string;
  className?: string;
}) {
  const Icon = ICON[status];
  return (
    <span
      className={cn(
        "text-label-xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 whitespace-nowrap",
        TONE[status],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {statusDisplay?.trim() || APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}
