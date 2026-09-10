"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

import { useCancelAppointment, useMarkArrived } from "../hooks/use-appointments";
import type { Appointment } from "../types/appointment";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";
import { AppointmentFormDialog } from "./appointment-form-dialog";
import { ArrivedDialog } from "./arrived-dialog";

interface AppointmentDialogsApi {
  openDetail: (appointment: Appointment) => void;
  openCreate: (prefill?: { phone?: string; name?: string }) => void;
  openEdit: (appointment: Appointment) => void;
  openArrived: (appointment: Appointment) => void;
  openCancel: (appointment: Appointment) => void;
  /** Visits with a write in flight, so their row can dim and lock. */
  busyIds: ReadonlySet<string>;
}

const AppointmentDialogsContext = createContext<AppointmentDialogsApi | null>(null);

export function useAppointmentDialogs(): AppointmentDialogsApi {
  const api = useContext(AppointmentDialogsContext);
  if (api === null) {
    throw new Error(
      "useAppointmentDialogs must be used inside AppointmentDialogsProvider",
    );
  }
  return api;
}

/**
 * Owns every appointment dialog once, for whatever list is inside it.
 *
 * The alternative — each row mounting its own copies — is what makes a queue of
 * twenty visits carry sixty dialogs, and what lets two of them end up open at
 * the same time when a row re-renders mid-transition.
 */
export function AppointmentDialogsProvider({ children }: { children: ReactNode }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [prefill, setPrefill] = useState<{ phone: string; name: string }>({
    phone: "",
    name: "",
  });

  const [detail, setDetail] = useState<Appointment | null>(null);
  const [arriving, setArriving] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState<Appointment | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());

  const arrive = useMarkArrived();
  const cancel = useCancelAppointment();

  const markBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((current) => {
      const next = new Set(current);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const api = useMemo<AppointmentDialogsApi>(
    () => ({
      busyIds,
      openDetail: (appointment) => setDetail(appointment),
      openCreate: (values) => {
        setEditing(null);
        setPrefill({ phone: values?.phone ?? "", name: values?.name ?? "" });
        setFormOpen(true);
      },
      openEdit: (appointment) => {
        setEditing(appointment);
        setPrefill({ phone: "", name: "" });
        setFormOpen(true);
      },
      openArrived: (appointment) => setArriving(appointment),
      openCancel: (appointment) => setCancelling(appointment),
    }),
    [busyIds],
  );

  async function confirmArrived(orderId: string | null) {
    const appointment = arriving;
    if (!appointment) return;
    markBusy(appointment.id, true);
    try {
      await arrive.mutateAsync({ id: appointment.id, orderId });
    } finally {
      markBusy(appointment.id, false);
    }
  }

  async function confirmCancel() {
    const appointment = cancelling;
    if (!appointment) return;
    setCancelling(null);
    markBusy(appointment.id, true);
    try {
      await cancel.mutateAsync(appointment.id);
    } finally {
      markBusy(appointment.id, false);
    }
  }

  return (
    <AppointmentDialogsContext.Provider value={api}>
      {children}

      <AppointmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        initialPhone={prefill.phone}
        initialName={prefill.name}
      />

      <AppointmentDetailDialog
        appointment={detail}
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        onArrived={(appointment) => setArriving(appointment)}
        onEdit={api.openEdit}
        onCancel={(appointment) => setCancelling(appointment)}
      />

      <ArrivedDialog
        appointment={arriving}
        open={arriving !== null}
        onOpenChange={(open) => !open && setArriving(null)}
        onConfirm={(orderId) => void confirmArrived(orderId)}
      />

      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tashrifni bekor qilish</AlertDialogTitle>
            <AlertDialogDescription>
              Bu tashrif bekor qilinsin. Mijozga bekor qilingani haqida xabar yuboriladi.
              Davom etasizmi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Yo&rsquo;q</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-danger-foreground"
              onClick={() => void confirmCancel()}
            >
              Ha, bekor qilish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppointmentDialogsContext.Provider>
  );
}
