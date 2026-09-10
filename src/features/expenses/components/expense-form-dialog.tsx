"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

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
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { nowTashkent, startOfDay, type TashkentDate } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import { useCreateExpense, useUpdateExpense } from "../hooks/use-expenses";
import { expenseSchema, type ExpenseFormValues } from "../schemas/expense-schema";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type Expense,
} from "../types/expense";

/**
 * Add or correct one expense.
 *
 * Editing is offered only while `canEdit` is true — the backend locks a record
 * the day after it was entered, and offering a button the server will refuse is
 * worse than not offering it.
 */
export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent for a new expense. */
  expense?: Expense | null;
}) {
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const editing = Boolean(expense);

  const {
    control,
    handleSubmit,
    register,
    reset,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      category: "other",
      paymentType: "cash",
      note: "",
      expenseDate: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset(
      expense
        ? {
            amount: expense.amount,
            category: expense.category,
            paymentType: expense.paymentType ?? "cash",
            note: expense.note,
            expenseDate: expense.expenseDate,
          }
        : {
            amount: 0,
            category: "other",
            paymentType: "cash",
            note: "",
            expenseDate: null,
          },
    );
  }, [open, expense, reset]);

  const submitting = create.isPending || update.isPending;

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      amount: values.amount,
      category: values.category,
      paymentType: values.paymentType,
      note: values.note ?? "",
      expenseDate: (values.expenseDate as TashkentDate | null) ?? null,
    };
    if (expense) await update.mutateAsync({ id: expense.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{editing ? "Xarajatni tahrirlash" : "Yangi xarajat"}</DialogTitle>
          <DialogDescription>
            Pul qaysi kassadan chiqqanini belgilang — aks holda u kunlik hisobda hech
            qaysi kassadan ayirilmaydi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount">Summa</Label>
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  id="amount"
                  autoFocus
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder="0"
                  aria-invalid={Boolean(errors.amount)}
                  aria-describedby={errors.amount ? "amount-error" : undefined}
                  className="h-[46px] text-lg font-bold"
                />
              )}
            />
            {errors.amount && (
              <p id="amount-error" role="alert" className="text-caption text-danger">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category">Turkum</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category" className="h-[46px] w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {EXPENSE_CATEGORY_LABEL[category]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expense-date">Sana</Label>
              <Controller
                control={control}
                name="expenseDate"
                render={({ field }) => (
                  <DateInput
                    id="expense-date"
                    value={(field.value as TashkentDate | null) ?? null}
                    onChange={field.onChange}
                    placeholder="Bugun"
                    toDate={startOfDay(nowTashkent())}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Qaysi kassadan</Label>
            <Controller
              control={control}
              name="paymentType"
              render={({ field }) => (
                <div role="radiogroup" aria-label="To'lov turi" className="flex gap-2">
                  {PAYMENT_TYPES.map((type) => (
                    <TillOption
                      key={type}
                      type={type}
                      selected={field.value === type}
                      onSelect={() => field.onChange(type)}
                    />
                  ))}
                </div>
              )}
            />
            {errors.paymentType && (
              <p role="alert" className="text-caption text-danger">
                {errors.paymentType.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Izoh</Label>
            <Textarea
              id="note"
              rows={3}
              placeholder="Nima uchun sarflandi?"
              {...register("note")}
            />
          </div>

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
              ) : (
                <Save className="size-4" aria-hidden />
              )}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TillOption({
  type,
  selected,
  onSelect,
}: {
  type: PaymentType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "text-label flex h-[46px] flex-1 items-center justify-center rounded-md border",
        "focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-primary bg-primary-soft text-primary-dark"
          : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
      )}
    >
      {PAYMENT_TYPE_LABEL[type]}
    </button>
  );
}
