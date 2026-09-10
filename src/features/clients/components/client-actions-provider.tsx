"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { AppointmentFormDialog } from "@/features/appointments/components/appointment-form-dialog";
import { useNewOrderStore } from "@/features/new-order/store/new-order-store";
import { TreatmentFormDialog } from "@/features/treatments/components/treatment-form-dialog";
import { AppRoutes } from "@/config/routes";
import { telUri } from "@/shared/lib/format/phone";

import { useAddClientNote } from "../hooks/use-clients";
import {
  recordName,
  searchResultFromRecord,
  type ClientRecord,
} from "../types/client-record";
import type { ClientRowAction } from "./client-row-actions";
import {
  ClientAnonymizeDialog,
  ClientBlockDialog,
  ClientNoteDialog,
  ClientUnblockDialog,
} from "./client-admin-dialogs";
import { ClientFormDialog } from "./client-form-dialog";

/** Everything reception can start from a client, wherever the client is shown. */
export interface ClientActionsApi {
  run: (client: ClientRecord, action: ClientRowAction) => void;
  create: (prefill?: { phone?: string; name?: string }) => void;
  edit: (client: ClientRecord) => void;
  block: (client: ClientRecord) => void;
  unblock: (client: ClientRecord) => void;
  anonymize: (client: ClientRecord) => void;
}

const ClientActionsContext = createContext<ClientActionsApi | null>(null);

export function useClientActions(): ClientActionsApi {
  const api = useContext(ClientActionsContext);
  if (api === null) {
    throw new Error("useClientActions must be used inside ClientActionsProvider");
  }
  return api;
}

/**
 * Owns the dialogs a client row or card can open, once for the whole page.
 *
 * Both the list and the 360° profile need the same six actions; keeping them
 * here means the visit form, the treatment form and the note composer behave
 * identically wherever reception started from.
 */
export function ClientActionsProvider({
  children,
  onSaved,
}: {
  children: ReactNode;
  /** Called after a card is created or edited, so a list can refresh. */
  onSaved?: (client: ClientRecord) => void;
}) {
  const router = useRouter();
  const addNote = useAddClientNote();
  const selectClient = useNewOrderStore((s) => s.selectClient);
  const attachAppointment = useNewOrderStore((s) => s.attachAppointment);

  const [formFor, setFormFor] = useState<ClientRecord | null>(null);
  const [formPrefill, setFormPrefill] = useState<{
    phone: string;
    name: string;
  }>({
    phone: "",
    name: "",
  });
  const [formOpen, setFormOpen] = useState(false);
  const [noteFor, setNoteFor] = useState<ClientRecord | null>(null);
  const [visitFor, setVisitFor] = useState<ClientRecord | null>(null);
  const [treatmentFor, setTreatmentFor] = useState<ClientRecord | null>(null);
  const [blockFor, setBlockFor] = useState<ClientRecord | null>(null);
  const [unblockFor, setUnblockFor] = useState<ClientRecord | null>(null);
  const [anonymizeFor, setAnonymizeFor] = useState<ClientRecord | null>(null);

  const startOrder = useCallback(
    (client: ClientRecord) => {
      // The order form is app-scoped and keeps its own draft, so this hands the
      // client over and navigates rather than opening yet another dialog.
      selectClient(searchResultFromRecord(client));
      attachAppointment(null);
      router.push(AppRoutes.newOrder);
    },
    [attachAppointment, router, selectClient],
  );

  const api = useMemo<ClientActionsApi>(
    () => ({
      create: (prefill) => {
        setFormFor(null);
        setFormPrefill({
          phone: prefill?.phone ?? "",
          name: prefill?.name ?? "",
        });
        setFormOpen(true);
      },
      edit: (client) => {
        setFormFor(client);
        setFormPrefill({ phone: "", name: "" });
        setFormOpen(true);
      },
      block: setBlockFor,
      unblock: setUnblockFor,
      anonymize: setAnonymizeFor,
      run: (client, action) => {
        switch (action) {
          case "newVisit":
            setVisitFor(client);
            return;
          case "newOrder":
            startOrder(client);
            return;
          case "newTreatment":
            setTreatmentFor(client);
            return;
          case "call":
            window.location.href = telUri(client.phone);
            return;
          case "edit":
            setFormFor(client);
            setFormPrefill({ phone: "", name: "" });
            setFormOpen(true);
            return;
          case "addNote":
            setNoteFor(client);
        }
      },
    }),
    [startOrder],
  );

  return (
    <ClientActionsContext.Provider value={api}>
      {children}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        record={formFor}
        initialPhone={formPrefill.phone}
        initialName={formPrefill.name}
        onSaved={onSaved}
        onOpenDuplicate={(client) => router.push(`/clients/${client.id}`)}
      />

      {noteFor && (
        <ClientNoteDialog
          clientName={recordName(noteFor)}
          open
          onOpenChange={(open) => !open && setNoteFor(null)}
          busy={addNote.isPending}
          onSubmit={(text) => {
            if (noteFor.id !== null) {
              void addNote.mutateAsync({ clientId: noteFor.id, text });
            }
          }}
        />
      )}

      <AppointmentFormDialog
        open={visitFor !== null}
        onOpenChange={(open) => !open && setVisitFor(null)}
        initialPhone={visitFor?.phone ?? ""}
        initialName={visitFor?.fullName ?? ""}
      />

      <TreatmentFormDialog
        open={treatmentFor !== null}
        onOpenChange={(open) => !open && setTreatmentFor(null)}
        initialClient={
          treatmentFor ? { phone: treatmentFor.phone, name: treatmentFor.fullName } : null
        }
      />

      {blockFor?.id != null && (
        <ClientBlockDialog
          clientId={blockFor.id}
          clientName={recordName(blockFor)}
          open
          onOpenChange={(open) => !open && setBlockFor(null)}
        />
      )}

      {unblockFor?.id != null && (
        <ClientUnblockDialog
          clientId={unblockFor.id}
          clientName={recordName(unblockFor)}
          open
          onOpenChange={(open) => !open && setUnblockFor(null)}
        />
      )}

      {anonymizeFor?.id != null && (
        <ClientAnonymizeDialog
          clientId={anonymizeFor.id}
          clientName={recordName(anonymizeFor)}
          open
          onOpenChange={(open) => !open && setAnonymizeFor(null)}
        />
      )}
    </ClientActionsContext.Provider>
  );
}
