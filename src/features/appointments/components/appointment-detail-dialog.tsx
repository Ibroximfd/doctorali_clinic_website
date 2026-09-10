"use client";

import {
  CalendarClock,
  CheckCircle2,
  Flag,
  IdCard,
  Loader2,
  Pencil,
  ReceiptText,
  ShoppingCart,
  StickyNote,
  Stethoscope,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { searchClients } from "@/features/clients/api/clients-api";
import { clientKeys } from "@/features/clients/hooks/use-client-search";
import { useNewOrderStore } from "@/features/new-order/store/new-order-store";
import { AppRoutes, clientDetailPath } from "@/config/routes";
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { money } from "@/shared/lib/format/money";
import { hhmm, shortDateTime } from "@/shared/lib/format/date";
import { phoneFromApi } from "@/shared/lib/format/phone";

import {
  appointmentPurposeLabel,
  isEditable,
  visitTypeLabel,
  type Appointment,
} from "../types/appointment";
import { AppointmentStatusChip } from "./appointment-status-chip";

/**
 * Everything known about one visit.
 *
 * There is no `GET appointments/{id}/`, and there does not need to be: the list
 * row already carries the whole record, so this reads straight off it instead
 * of re-fetching what it was handed.
 */
export function AppointmentDetailDialog({
  appointment,
  open,
  onOpenChange,
  onArrived,
  onEdit,
  onCancel,
}: {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArrived: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const selectClient = useNewOrderStore((s) => s.selectClient);
  const attachAppointment = useNewOrderStore((s) => s.attachAppointment);
  const [startingOrder, setStartingOrder] = useState(false);

  if (!appointment) return null;

  const hasClientCard = appointment.client !== null && appointment.client.id > 0;
  const isScheduled = appointment.status === "scheduled";

  /**
   * Rings this visit up. The client is looked up rather than reconstructed from
   * the visit's own fields: the order form shows their debt and visit count,
   * and a card built from an appointment would show zeros for both.
   */
  async function startOrder(visit: Appointment) {
    setStartingOrder(true);
    try {
      const phone = visit.clientPhone;
      const matches = await queryClient.fetchQuery({
        queryKey: clientKeys.search(phone),
        queryFn: () => searchClients({ query: phone }),
        staleTime: 30_000,
      });
      const match = matches.find((c) => c.phone === phone) ?? null;
      selectClient(match);
      attachAppointment(visit.id);
      onOpenChange(false);
      router.push(AppRoutes.newOrder);
    } finally {
      setStartingOrder(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="tabular">
            {shortDateTime(appointment.scheduledAt)}
          </DialogTitle>
          <DialogDescription>
            {visitTypeLabel(appointment)}
            {appointment.visitNumber > 0 && ` · ${appointment.visitNumber}-tashrif`}
            {appointment.createdByName !== "" && ` · ${appointment.createdByName}`}
          </DialogDescription>
          {/* Outside the title, so a screen reader announces the day and the
              status as two facts rather than one run-on string. */}
          <AppointmentStatusChip
            status={appointment.status}
            statusDisplay={appointment.statusDisplay}
            className="mt-1 self-start"
          />
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="border-border bg-surface-alt flex items-center gap-3 rounded-md border p-3">
            <AppAvatar
              name={appointment.clientName}
              imageUrl={appointment.client?.avatarUrl ?? null}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <p className="text-title-sm truncate">{appointment.clientName}</p>
              <p className="text-caption text-text-secondary tabular truncate">
                {phoneFromApi(appointment.clientPhone)}
              </p>
            </div>
            {hasClientCard && (
              <Button asChild variant="outline" size="sm">
                <Link href={clientDetailPath(appointment.client!.id)}>
                  <IdCard className="size-4" aria-hidden />
                  Kartochka
                </Link>
              </Button>
            )}
          </div>

          <InfoRow
            icon={Flag}
            label="Maqsad"
            value={appointmentPurposeLabel(appointment)}
          />

          {appointment.doctor && (
            <InfoRow
              icon={Stethoscope}
              label="Shifokor"
              value={appointment.doctor.fullName}
              hint={appointment.doctor.specialty || undefined}
            />
          )}

          {appointment.arrivedAt && (
            <InfoRow
              icon={CalendarClock}
              label="Kelgan vaqti"
              value={hhmm(appointment.arrivedAt)}
            />
          )}

          {appointment.note !== "" && (
            <InfoRow icon={StickyNote} label="Izoh" value={appointment.note} />
          )}

          {appointment.order ? (
            <InfoRow
              icon={ReceiptText}
              label="Bog'langan buyurtma"
              value={appointment.order.orderNumber || appointment.order.id}
              hint={
                appointment.order.totalAmount > 0
                  ? money.uzs(appointment.order.totalAmount)
                  : undefined
              }
            />
          ) : (
            appointment.orderId && (
              <InfoRow
                icon={ReceiptText}
                label="Bog'langan buyurtma"
                value={appointment.orderId}
              />
            )
          )}

          {appointment.treatments.length > 0 && (
            <div className="border-border rounded-md border p-3">
              <p className="text-label-xs text-text-tertiary mb-2">Muolajalar</p>
              <ul className="flex flex-col gap-1.5">
                {appointment.treatments.map((treatment) => (
                  <li key={treatment.id} className="text-caption flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {treatment.kindLabel}
                      {treatment.description !== "" && ` · ${treatment.description}`}
                    </span>
                    <span className="text-label tabular shrink-0">
                      {money.plain(treatment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {appointment.orderId === null && (
            <Button
              type="button"
              variant="secondary"
              disabled={startingOrder}
              onClick={() => void startOrder(appointment)}
            >
              {startingOrder ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ShoppingCart className="size-4" aria-hidden />
              )}
              Buyurtma yaratish
            </Button>
          )}

          <div className="flex gap-2">
            {isScheduled && (
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  onArrived(appointment);
                }}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Keldi
              </Button>
            )}
            {isEditable(appointment) && (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(appointment);
                }}
              >
                <Pencil className="size-4" aria-hidden />
                Tahrirlash
              </Button>
            )}
            {isScheduled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label="Bekor qilish"
                onClick={() => {
                  onOpenChange(false);
                  onCancel(appointment);
                }}
              >
                <XCircle className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-surface-alt flex size-8 shrink-0 items-center justify-center rounded-sm">
        <Icon className="text-text-secondary size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-caption text-text-tertiary block">{label}</span>
        <span className="text-title-sm block break-words">{value}</span>
        {hint && <span className="text-caption text-text-tertiary block">{hint}</span>}
      </span>
    </div>
  );
}
