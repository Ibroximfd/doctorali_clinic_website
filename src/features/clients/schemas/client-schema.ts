import { z } from "zod";

import { isPhoneComplete, nationalDigits } from "@/shared/lib/format/phone";

const extraPhoneSchema = z.object({
  /** Masked `+998 (90) 123-45-67`; converted at the request boundary. */
  phone: z.string(),
  label: z.string(),
});

const baseSchema = z.object({
  phone: z.string(),
  fullName: z.string(),
  gender: z.enum(["male", "female", "unknown"]),
  birthDate: z.date().nullable(),
  /** Kept as text so an empty box is distinguishable from a zero. */
  age: z.string(),
  address: z.string(),
  note: z.string(),
  tags: z.array(z.string()),
  extraPhones: z.array(extraPhoneSchema),
});

export type ClientFormValues = z.infer<typeof baseSchema>;

/** Ages outside this range are a typo, not a client. */
const MAX_AGE = 120;

/**
 * The card's rules, carried over from the Flutter form with its messages.
 *
 * An extra number that is started but not finished blocks the save rather than
 * being dropped in silence: "saved" with a number quietly missing is the worse
 * outcome. A blank row is fine — it is simply ignored.
 */
export function clientSchema(context: { editing: boolean }) {
  return baseSchema.superRefine((values, ctx) => {
    if (!context.editing && !isPhoneComplete(values.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefon raqamini to'liq kiriting",
      });
    }

    if (values.fullName.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fullName"],
        message: "Mijoz ismini kiriting",
      });
    }

    const ageText = values.age.trim();
    if (ageText !== "") {
      const age = Number(ageText);
      if (!Number.isInteger(age) || age <= 0 || age > MAX_AGE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["age"],
          message: "Yoshni to'g'ri kiriting",
        });
      }
    }

    values.extraPhones.forEach((extra, index) => {
      const digits = nationalDigits(extra.phone);
      if (digits !== "" && digits.length !== 9) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["extraPhones", index, "phone"],
          message: "Qo'shimcha raqamni to'liq kiriting yoki qatorni o'chiring",
        });
      }
    });
  });
}
