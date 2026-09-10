import { z } from "zod";

import { nowTashkent } from "@/shared/lib/format/date";
import { isPhoneComplete } from "@/shared/lib/format/phone";

import { APPOINTMENT_PURPOSES } from "../types/appointment";

const doctorRefSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  specialty: z.string(),
  avatarUrl: z.string().nullable(),
});

const baseSchema = z.object({
  /** Masked `+998 (90) 123-45-67`; converted with `phoneToApi` at submit. */
  phone: z.string(),
  name: z.string(),
  visitMode: z.enum(["walk_in", "scheduled"]),
  /** Tashkent day; the time of day is carried separately by `scheduledTime`. */
  scheduledDate: z.date().nullable(),
  /** `HH:mm`. */
  scheduledTime: z.string(),
  purpose: z.enum(APPOINTMENT_PURPOSES),
  doctor: doctorRefSchema.nullable(),
  note: z.string(),
});

export type AppointmentFormValues = z.infer<typeof baseSchema>;

/**
 * Validation rules carried over from the Flutter form, messages included.
 *
 * Two flags change what is even asked for:
 *  • `editing` — the phone is read-only, because a different phone means a
 *    different person and therefore a different visit.
 *  • `partialEdit` — the client has already arrived, so the time and the name
 *    are settled facts; only the doctor, the purpose and the note are still in
 *    play and nothing else is validated (or sent).
 */
export function appointmentSchema(context: { editing: boolean; partialEdit: boolean }) {
  return baseSchema.superRefine((values, ctx) => {
    if (context.partialEdit) return;

    if (values.name.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "Mijoz ismini kiriting",
      });
    }

    if (!context.editing && !isPhoneComplete(values.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefon raqamini to'liq kiriting",
      });
    }

    // A walk-in has no time to validate — the server stamps its own clock.
    if (values.visitMode === "walk_in" && !context.editing) return;

    // Both sides are Tashkent wall-clock (the app's frame); comparing against
    // `Date.now()` here would be five hours out.
    const moment = combineDateTime(values.scheduledDate, values.scheduledTime);
    if (moment === null || moment.getTime() <= nowTashkent().getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scheduledDate"],
        message: "Kelajakdagi sana va vaqtni tanlang",
      });
    }
  });
}

/**
 * Merges the picked day with the picked `HH:mm` into one Tashkent moment.
 *
 * Both halves live in the app's Tashkent frame — wall-clock in the UTC fields —
 * so the time is written with `setUTCHours` and read back the same way.
 */
export function combineDateTime(date: Date | null, time: string): Date | null {
  if (date === null) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const merged = new Date(date.getTime());
  merged.setUTCHours(hours, minutes, 0, 0);
  return merged;
}
