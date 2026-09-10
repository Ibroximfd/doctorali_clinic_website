"use client";

import { CheckCircle2, MoreVertical, Pencil, XCircle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

import { isEditable, type Appointment } from "../types/appointment";

export type AppointmentAction = "arrived" | "edit" | "cancel";

/**
 * Quick actions for one visit. Options follow the backend's status rules:
 * "Keldi" and "Bekor qilish" only while `scheduled`, "Tahrirlash" while the
 * visit is still editable at all. A `no_show` row offers nothing — that status
 * is set purely by the nightly job.
 */
export function AppointmentActionsMenu({
  appointment,
  onSelect,
  disabled,
}: {
  appointment: Appointment;
  onSelect: (action: AppointmentAction) => void;
  disabled?: boolean;
}) {
  const isScheduled = appointment.status === "scheduled";
  const canEdit = isEditable(appointment);
  if (!isScheduled && !canEdit) return <span className="size-8" />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={`${appointment.clientName} uchun amallar`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical className="text-text-secondary size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {isScheduled && (
          <DropdownMenuItem onSelect={() => onSelect("arrived")}>
            <CheckCircle2 className="size-4" aria-hidden />
            Keldi
          </DropdownMenuItem>
        )}
        {canEdit && (
          <DropdownMenuItem onSelect={() => onSelect("edit")}>
            <Pencil className="size-4" aria-hidden />
            Tahrirlash
          </DropdownMenuItem>
        )}
        {isScheduled && (
          <DropdownMenuItem variant="destructive" onSelect={() => onSelect("cancel")}>
            <XCircle className="size-4" aria-hidden />
            Bekor qilish
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
