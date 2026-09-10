import { z } from "zod";

import { EXPENSE_CATEGORIES } from "../types/expense";
import { PAYMENT_TYPES } from "@/shared/domain/payment-type";

/**
 * Expense form rules, matching the backend's.
 *
 * `paymentType` is required even though the API tolerates its absence: an
 * expense with no till is counted in the day's total but comes off no drawer,
 * which is exactly the row that later makes a handover fail to balance. The
 * form insists so that row is never created again.
 */
export const expenseSchema = z.object({
  amount: z.number().int().positive("Summani kiriting"),
  category: z.enum(EXPENSE_CATEGORIES),
  paymentType: z.enum(PAYMENT_TYPES, { message: "To'lov turini tanlang" }),
  note: z.string().max(500, "Izoh juda uzun").optional(),
  /** Null means "today", which is what the backend defaults to. */
  expenseDate: z.date().nullable(),
});

export type ExpenseFormValues = z.infer<typeof expenseSchema>;
