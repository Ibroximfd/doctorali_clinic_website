"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  BellRing,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock,
  Footprints,
  Lock,
  Save,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { DateInput } from "@/shared/components/form/date-input";
import { PhoneInput } from "@/shared/components/form/phone-input";
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
import { Textarea } from "@/shared/components/ui/textarea";
import { ApiError } from "@/shared/lib/api/errors";
import {
  hhmm,
  nowTashkent,
  startOfDay,
  type TashkentDate,
} from "@/shared/lib/format/date";
import { phoneFromApi, phoneToApi } from "@/shared/lib/format/phone";
import { uuidV4 } from "@/shared/lib/uuid";
import { cn } from "@/shared/lib/utils";

import { useCreateAppointment, useUpdateAppointment } from "../hooks/use-appointments";
import {
  appointmentSchema,
  combineDateTime,
  type AppointmentFormValues,
} from "../schemas/appointment-schema";
import {
  APPOINTMENT_PURPOSES,
  PURPOSE_LABEL,
  isPartiallyEditable,
  type Appointment,
  type VisitType,
} from "../types/appointment";
import { DoctorRefPicker } from "./doctor-ref-picker";

/** How long the confirmation stays on screen before the dialog closes itself. */
const SUCCESS_HOLD_MS = 1600;

/** Server field name → form field name, for a refused save. */
const FIELD_MAP: Readonly<Record<string, keyof AppointmentFormValues>> = {
  client_phone: "phone",
  client_name: "name",
  scheduled_at: "scheduledDate",
  doctor_id: "doctor",
  note: "note",
};

interface SuccessInfo {
  readonly inApp: boolean;
  readonly clientCreated: boolean;
  readonly walkIn: boolean;
}

/**
 * Books a visit, or corrects one.
 *
 * The first question decides the rest of the form: a client standing at the
 * desk ("Hozir keldi") sends no time at all — the server stamps its own clock
 * and files the visit as `arrived` — while a booked slot reveals the day and
 * time and starts the reminder chain. Editing an arrived visit narrows the form
 * to the three fields the backend still accepts.
 */
export function AppointmentFormDialog({
  open,
  onOpenChange,
  existing,
  initialPhone = "",
  initialName = "",
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing an existing visit. */
  existing?: Appointment | null;
  /** API phone value, pre-filled when the dialog is opened from a search. */
  initialPhone?: string;
  initialName?: string;
  onSaved?: (appointment: Appointment) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        // Mounted per opening and keyed by what it is editing, so the fields,
        // the confirmation and the idempotency key all start clean — no effect
        // has to clear them after the fact.
        <AppointmentFormBody
          key={existing ? `edit:${existing.id}` : `new:${initialPhone}:${initialName}`}
          existing={existing ?? null}
          initialPhone={initialPhone}
          initialName={initialName}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function AppointmentFormBody({
  existing,
  initialPhone,
  initialName,
  onOpenChange,
  onSaved,
}: {
  existing: Appointment | null;
  initialPhone: string;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (appointment: Appointment) => void;
}) {
  const create = useCreateAppointment();
  const update = useUpdateAppointment();

  const editing = existing !== null;
  const partialEdit = existing ? isPartiallyEditable(existing) : false;
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  /**
   * One key for this form's whole life — every retry of the same submission
   * carries it, so a dropped connection followed by a second tap cannot book
   * the same client twice. A new opening mounts a new form, and mints a new key.
   */
  const [idempotencyKey] = useState(uuidV4);

  const {
    control,
    handleSubmit,
    register,
    setError,
    formState: { errors },
  } = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema({ editing, partialEdit })),
    defaultValues: existing
      ? {
          phone: phoneFromApi(existing.clientPhone),
          name: existing.clientName,
          visitMode: existing.visitType,
          scheduledDate: startOfDay(existing.scheduledAt),
          scheduledTime: hhmm(existing.scheduledAt),
          purpose: existing.purpose,
          doctor: existing.doctor,
          note: existing.note,
        }
      : {
          ...emptyValues(),
          phone: initialPhone === "" ? "" : phoneFromApi(initialPhone),
          name: initialName,
        },
  });

  // Lets the confirmation play before the dialog closes itself.
  useEffect(() => {
    if (success === null) return;
    const id = window.setTimeout(() => onOpenChange(false), SUCCESS_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [success, onOpenChange]);

  const visitMode = useWatch({ control, name: "visitMode" });
  const isWalkIn = visitMode === "walk_in" && !editing;
  const submitting = create.isPending || update.isPending;

  function applyServerErrors(error: unknown): void {
    if (!ApiError.is(error)) {
      setFormError("Kutilmagan xatolik yuz berdi. Qayta urinib ko'ring.");
      return;
    }
    let matched = false;
    for (const [apiField, messages] of Object.entries(error.fieldErrors)) {
      const field = FIELD_MAP[apiField];
      if (field && messages.length > 0) {
        setError(field, { message: messages[0] });
        matched = true;
      }
    }
    // Only surface the banner for something the fields don't already say.
    setFormError(matched ? null : error.message);
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const scheduledAt = combineDateTime(
      values.scheduledDate,
      values.scheduledTime,
    ) as TashkentDate | null;

    try {
      if (existing) {
        const updated = await update.mutateAsync({
          id: existing.id,
          input: {
            clientName: values.name.trim(),
            scheduledAt,
            purpose: values.purpose,
            doctorId: values.doctor?.id ?? null,
            note: values.note,
            partial: partialEdit,
          },
        });
        onSaved?.(updated);
        onOpenChange(false);
        return;
      }

      const result = await create.mutateAsync({
        clientPhone: phoneToApi(values.phone),
        clientName: values.name.trim(),
        scheduledAt: values.visitMode === "walk_in" ? null : scheduledAt,
        arriveNow: values.visitMode === "walk_in",
        purpose: values.purpose,
        doctorId: values.doctor?.id ?? null,
        note: values.note,
        idempotencyKey,
      });
      onSaved?.(result.appointment);
      setSuccess({
        inApp: result.inApp,
        clientCreated: result.clientCreated,
        walkIn: values.visitMode === "walk_in",
      });
    } catch (error) {
      applyServerErrors(error);
    }
  });

  return (
    <DialogContent className="max-h-[86vh] gap-0 overflow-y-auto sm:max-w-[520px]">
      {success ? (
        <SuccessView info={success} />
      ) : (
        <>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Tashrifni tahrirlash" : "Yangi tashrif"}
            </DialogTitle>
            <DialogDescription>
              {partialEdit
                ? "Mijoz allaqachon keldi — faqat shifokor, maqsad va izohni o'zgartirish mumkin."
                : "Mijoz hozir keldimi yoki keyinroq keladimi — shuni belgilang."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 pt-4">
            {/* Mode first: it decides whether a time is even asked for. */}
            {!editing && (
              <Controller
                control={control}
                name="visitMode"
                render={({ field }) => (
                  <VisitModeSelector value={field.value} onChange={field.onChange} />
                )}
              />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="appointment-phone">Telefon raqami</Label>
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <PhoneInput
                    id="appointment-phone"
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={editing}
                    autoFocus={!editing && field.value === ""}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={
                      errors.phone ? "appointment-phone-error" : undefined
                    }
                    className={cn("h-[46px]", errors.phone && "border-danger")}
                  />
                )}
              />
              {editing && (
                <p className="text-caption text-text-tertiary">
                  Raqamni o&rsquo;zgartirib bo&rsquo;lmaydi — boshqa raqam boshqa mijoz
                  demakdir.
                </p>
              )}
              <FieldError id="appointment-phone-error" message={errors.phone?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-name">Mijoz ismi</Label>
              <Input
                id="appointment-name"
                placeholder="Ism familiya"
                disabled={partialEdit}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "appointment-name-error" : undefined}
                className={cn("h-[46px]", errors.name && "border-danger")}
                {...register("name")}
              />
              <FieldError id="appointment-name-error" message={errors.name?.message} />
            </div>

            {isWalkIn ? (
              <WalkInTimeNotice />
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="appointment-date">Tashrif sanasi va vaqti</Label>
                <div className="flex gap-2">
                  <Controller
                    control={control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <DateInput
                        id="appointment-date"
                        value={(field.value as TashkentDate | null) ?? null}
                        onChange={field.onChange}
                        disabled={partialEdit}
                        fromDate={partialEdit ? undefined : startOfDay(nowTashkent())}
                        aria-invalid={Boolean(errors.scheduledDate)}
                        className={cn(
                          "h-[46px] flex-1",
                          errors.scheduledDate && "border-danger",
                        )}
                      />
                    )}
                  />
                  <Input
                    type="time"
                    step={300}
                    aria-label="Tashrif vaqti"
                    disabled={partialEdit}
                    className={cn(
                      "tabular h-[46px] w-[130px] shrink-0",
                      errors.scheduledDate && "border-danger",
                    )}
                    {...register("scheduledTime")}
                  />
                </div>
                {partialEdit && (
                  <p className="text-caption text-text-tertiary flex items-center gap-1.5">
                    <Lock className="size-3.5" aria-hidden />
                    Kelgan tashrifning vaqti — bu fakt, sozlama emas.
                  </p>
                )}
                <FieldError message={errors.scheduledDate?.message} />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Maqsad</Label>
              <Controller
                control={control}
                name="purpose"
                render={({ field }) => (
                  <div
                    role="radiogroup"
                    aria-label="Maqsad"
                    className="border-border bg-surface-alt flex flex-wrap gap-1 rounded-md border p-1"
                  >
                    {APPOINTMENT_PURPOSES.map((purpose) => (
                      <button
                        key={purpose}
                        type="button"
                        role="radio"
                        aria-checked={field.value === purpose}
                        onClick={() => field.onChange(purpose)}
                        className={cn(
                          "text-label-sm flex-1 rounded-sm px-2.5 py-2 whitespace-nowrap transition-colors",
                          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                          field.value === purpose
                            ? "bg-surface text-text-primary shadow-xs"
                            : "text-text-tertiary hover:text-text-primary",
                        )}
                      >
                        {PURPOSE_LABEL[purpose]}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-doctor">Shifokor</Label>
              <Controller
                control={control}
                name="doctor"
                render={({ field }) => (
                  <DoctorRefPicker
                    id="appointment-doctor"
                    value={field.value}
                    onChange={field.onChange}
                    onClear={() => field.onChange(null)}
                  />
                )}
              />
              <FieldError message={errors.doctor?.message} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="appointment-note">Izoh</Label>
              <Textarea
                id="appointment-note"
                rows={2}
                placeholder="Ixtiyoriy — mijoz haqida qisqacha"
                {...register("note")}
              />
              <FieldError message={errors.note?.message} />
            </div>

            {formError && (
              <p
                role="alert"
                className="bg-danger/10 text-caption text-danger rounded-md p-3"
              >
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Bekor qilish
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <span
                    className="border-primary-foreground/40 border-t-primary-foreground size-4 animate-spin rounded-full border-2"
                    aria-hidden
                  />
                ) : editing ? (
                  <Save className="size-4" aria-hidden />
                ) : (
                  <CalendarPlus className="size-4" aria-hidden />
                )}
                {editing ? "Saqlash" : "Tashrifni saqlash"}
              </Button>
            </DialogFooter>
          </form>
        </>
      )}
    </DialogContent>
  );
}

function emptyValues(): AppointmentFormValues {
  const slot = nextSlot();
  return {
    phone: "",
    name: "",
    // Most visits at a clinic desk are unannounced, so this is the default.
    visitMode: "walk_in",
    scheduledDate: startOfDay(slot),
    scheduledTime: hhmm(slot),
    purpose: "product",
    doctor: null,
    note: "",
  };
}

/**
 * The next :00 or :30 — what a booked visit starts on.
 *
 * Defaulting to the current minute would hand the desk a time that is already
 * in the past by the time they finish typing the name, and a validation error
 * for a field they never touched.
 */
function nextSlot(): TashkentDate {
  const slot = new Date(nowTashkent().getTime());
  slot.setUTCSeconds(0, 0);
  slot.setUTCMinutes(slot.getUTCMinutes() < 30 ? 30 : 60);
  return slot as TashkentDate;
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-caption text-danger">
      {message}
    </p>
  );
}

/**
 * "Is the client here now, or coming later?" — the answer changes the rest of
 * the form, so it is asked first.
 */
function VisitModeSelector({
  value,
  onChange,
}: {
  value: VisitType;
  onChange: (mode: VisitType) => void;
}) {
  const options: readonly {
    mode: VisitType;
    icon: typeof Footprints;
    title: string;
    subtitle: string;
  }[] = [
    {
      mode: "walk_in",
      icon: Footprints,
      title: "Hozir keldi",
      subtitle: "Hozirgi vaqt olinadi",
    },
    {
      mode: "scheduled",
      icon: CalendarClock,
      title: "Keyinroq keladi",
      subtitle: "Sana va vaqt tanlanadi",
    },
  ];

  return (
    <div role="radiogroup" aria-label="Tashrif turi" className="grid grid-cols-2 gap-2">
      {options.map(({ mode, icon: Icon, title, subtitle }) => {
        const selected = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(mode)}
            className={cn(
              "flex items-center gap-2.5 rounded-md border p-3 text-left transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "border-primary bg-primary-soft"
                : "border-border bg-surface hover:bg-surface-hover",
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0",
                selected ? "text-primary" : "text-text-tertiary",
              )}
              aria-hidden
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "text-label block truncate",
                  selected ? "text-primary-dark" : "text-text-primary",
                )}
              >
                {title}
              </span>
              <span className="text-label-xs text-text-tertiary block truncate">
                {subtitle}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Stands in for the picker in walk-in mode: nothing to choose, so it explains. */
function WalkInTimeNotice() {
  return (
    <p className="border-primary/30 bg-primary-soft text-caption text-text-secondary flex items-center gap-2.5 rounded-md border px-3.5 py-3.5">
      <Clock className="text-primary size-5 shrink-0" aria-hidden />
      Hozirgi vaqt olinadi — mijoz darhol &laquo;Keldi&raquo; holatida yoziladi
    </p>
  );
}

/** Brief confirmation shown in place of the form right after a successful create. */
function SuccessView({ info }: { info: SuccessInfo }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <DialogTitle className="sr-only">Tashrif yaratildi</DialogTitle>
      <span className="animate-in bg-primary-soft zoom-in-50 flex size-[72px] items-center justify-center rounded-full duration-300">
        <Check className="text-primary size-10" aria-hidden />
      </span>
      <p className="text-title-lg">
        {info.walkIn ? "Mijoz qabul qilindi" : "Tashrif rejalashtirildi"}
      </p>
      {info.clientCreated && (
        <p className="text-body text-text-secondary">Yangi mijoz kartasi ochildi</p>
      )}
      {/* A walk-in never triggers the booking reminder — the client is already
          at the desk — so promising one would lie. */}
      {info.inApp && !info.walkIn && (
        <p className="bg-primary-soft text-title-sm text-primary-dark flex items-center gap-2 rounded-md px-4 py-3">
          <BellRing className="size-4" aria-hidden />
          Ertalab eslatma boradi ✅
        </p>
      )}
    </div>
  );
}
