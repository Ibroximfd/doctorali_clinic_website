"use client";

import { useState } from "react";

import { DoctorPicker } from "@/features/doctors/components/doctor-picker";
import { useDoctorsQuery } from "@/features/doctors/hooks/use-doctors";
import type { Doctor } from "@/features/doctors/types/doctor";
import { PinConfirmDialog } from "@/features/security/components/pin-confirm-dialog";
import { usePinGate } from "@/features/security/hooks/use-pin-gate";
import { DateInput } from "@/shared/components/form/date-input";
import { MoneyInput } from "@/shared/components/form/money-input";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  addDays,
  isSameDay,
  isToday,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";

import { useUpdateTreatment } from "../hooks/use-treatments";
import { treatmentKindLabel, type Treatment } from "../types/treatment";

/**
 * Edits a recorded service (`PATCH treatments/{id}/`): what was done, what it
 * cost, which doctor performed it and on which day.
 *
 * A service from an earlier day can be corrected too — the save then asks for
 * the 4-digit PIN, which travels with the request so the server checks it as
 * well. Changing the amount or the doctor makes the backend recompute the
 * commission; it refuses once that commission has been paid out, and its Uzbek
 * message is shown as-is.
 */
export function TreatmentEditDialog({
  treatment,
  open,
  onOpenChange,
}: {
  treatment: Treatment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open && treatment !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        {/* Keyed by the record, so each opening starts from that service's own
            values without an effect having to reset the fields. */}
        {treatment && (
          <EditForm
            key={treatment.id}
            treatment={treatment}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ treatment, onDone }: { treatment: Treatment; onDone: () => void }) {
  const update = useUpdateTreatment();
  const pinGate = usePinGate();
  const { data: doctors } = useDoctorsQuery();

  const [description, setDescription] = useState(treatment.description);
  const [amount, setAmount] = useState(treatment.amount);
  // Derived, not copied: the doctor list usually arrives after this dialog
  // renders, and a state initialiser would leave the field empty for good.
  const [picked, setDoctor] = useState<Doctor | null>(null);
  const doctor = picked ?? doctorOf(treatment, doctors?.results) ?? null;
  const [performedAt, setPerformedAt] = useState<TashkentDate>(treatment.performedAt);
  const [error, setError] = useState<string | null>(null);

  const today = startOfDay(nowTashkent());
  const movedDay = !isSameDay(performedAt, treatment.performedAt);
  /** Either the service already belonged to another day, or it is moving to one. */
  const needsPin = !isToday(treatment.performedAt) || !isToday(performedAt);

  function send(confirmPin?: string) {
    update.mutate(
      {
        id: treatment.id,
        patch: {
          description,
          amount,
          ...(doctor ? { doctorId: doctor.id } : {}),
          // Only sent when the desk actually moved the service.
          ...(movedDay ? { performedAt } : {}),
          confirmPin: confirmPin ?? null,
        },
      },
      {
        onSuccess: onDone,
        onError: (failure: unknown) => {
          const code = (failure as { code?: string }).code;
          // The server counts days in Asia/Tashkent and may place the service
          // outside today when this clock didn't: ask once, re-send as is.
          if ((code === "pin_required" || code === "edit_window_closed") && !confirmPin) {
            pinGate.requestPin((pin) => send(pin));
            return;
          }
          setError(failure instanceof Error ? failure.message : "Xatolik yuz berdi");
        },
      },
    );
  }

  function submit() {
    if (amount <= 0) {
      setError("Summani kiriting");
      return;
    }
    setError(null);
    if (needsPin) pinGate.requestPin((pin) => send(pin));
    else send();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{treatmentKindLabel(treatment)}ni tahrirlash</DialogTitle>
        <DialogDescription>
          {treatment.clientName || "Mijoz"}
          {needsPin && " · bugungi yozuv emas, PIN so'raladi"}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="treatment-description">Nima qilindi</Label>
          <Input
            id="treatment-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Muolaja nomi"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-amount">Summa</Label>
          <MoneyInput
            id="treatment-amount"
            value={amount}
            onValueChange={setAmount}
            aria-invalid={amount <= 0}
            className="h-11 text-right text-lg font-bold"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-doctor">Shifokor</Label>
          <DoctorPicker id="treatment-doctor" value={doctor} onChange={setDoctor} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="treatment-date">Sana</Label>
          <DateInput
            id="treatment-date"
            value={performedAt}
            onChange={setPerformedAt}
            // A year back, the same window the backend's `backdate_too_old`
            // refusal uses; a service cannot be performed in the future.
            fromDate={addDays(today, -365)}
            toDate={today}
          />
        </div>

        {error && (
          <p role="alert" className="text-caption text-danger">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Bekor
        </Button>
        <Button type="button" onClick={submit} disabled={update.isPending}>
          Saqlash
        </Button>
      </DialogFooter>

      <PinConfirmDialog
        open={pinGate.open}
        onOpenChange={pinGate.handleOpenChange}
        onConfirmed={pinGate.handleConfirmed}
        description="Yozuv bugungi emas. O'zgarishni saqlash uchun 4 xonali PIN-kodni kiriting."
      />
    </>
  );
}

/**
 * The doctor as a full record, so the picker shows the name it already has.
 * The list is an aid: when it hasn't loaded, the field simply starts empty and
 * the other fields stay editable — an unreachable doctor list must not block
 * correcting a typo in the amount.
 */
function doctorOf(
  treatment: Treatment,
  doctors: readonly Doctor[] | undefined,
): Doctor | undefined {
  if (!treatment.doctor) return undefined;
  return doctors?.find((d) => d.id === treatment.doctor?.id);
}
