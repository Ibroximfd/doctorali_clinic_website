"use client";

import { Banknote, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppCard } from "@/shared/components/data-display/app-card";
import { ActiveFilters } from "@/shared/components/data-display/active-filters";
import { DateFilter } from "@/shared/components/data-display/date-filter";
import { FilterBar, FilterSelect } from "@/shared/components/data-display/filter-bar";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
import { PageContainer } from "@/shared/components/data-display/page-container";
import { PaginationBar } from "@/shared/components/data-display/pagination-bar";
import { SearchField } from "@/shared/components/data-display/search-field";
import { EmptyState } from "@/shared/components/feedback/empty-state";
import { ErrorState } from "@/shared/components/feedback/error-state";
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
import { Button } from "@/shared/components/ui/button";
import type { DateRange } from "@/shared/domain/date-range";
import { rangeLabel } from "@/shared/domain/date-range-label";
import {
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABEL,
  type PaymentType,
} from "@/shared/domain/payment-type";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { addDays, dayMonth, shortDate } from "@/shared/lib/format/date";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import type { ExpenseFilter } from "../api/expenses-api";
import {
  useDeleteExpense,
  useExpenseSummaryQuery,
  useExpensesQuery,
} from "../hooks/use-expenses";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  expenseCategoryLabel,
  expensePaymentLabel,
  type Expense,
  type ExpenseCategory,
} from "../types/expense";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpenseSummaryStrip } from "./expense-summary-strip";

const PAGE_SIZE = 20;

/** "Xarajatlar" — what left the tills, and which drawer it came off. */
export function ExpensesView() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const debouncedSearch = useDebouncedValue(search);

  const filter = useMemo<ExpenseFilter>(
    () => ({
      search: debouncedSearch,
      category,
      paymentType,
      dateFrom: range?.start ?? null,
      // The app's range end is exclusive; the API's `date_to` is inclusive.
      dateTo: range ? addDays(range.end, -1) : null,
      ordering: "-expense_date",
    }),
    [debouncedSearch, category, paymentType, range],
  );

  const list = useExpensesQuery(filter, page);
  const summary = useExpenseSummaryQuery(filter);
  const remove = useDeleteExpense();

  function resetPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <PageContainer className="flex flex-col gap-4">
      <FilterBar
        extraCount={paymentType === null ? 0 : 1}
        extra={
          <FilterSelect
            label="To'lov turi"
            value={paymentType}
            onChange={resetPage(setPaymentType)}
            options={PAYMENT_TYPES.map((type) => ({
              value: type,
              label: PAYMENT_TYPE_LABEL[type],
            }))}
            allLabel="Barcha to'lovlar"
          />
        }
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            Xarajat qo&rsquo;shish
          </Button>
        }
      >
        <SearchField
          value={search}
          onChange={resetPage(setSearch)}
          placeholder="Izoh bo'yicha qidirish…"
          className="w-full sm:w-[260px]"
        />
        <DateFilter value={range} onChange={resetPage(setRange)} />
        <FilterSelect
          label="Turkum"
          value={category}
          onChange={resetPage(setCategory)}
          options={EXPENSE_CATEGORIES.map((value) => ({
            value,
            label: EXPENSE_CATEGORY_LABEL[value],
          }))}
          allLabel="Barcha turkumlar"
          width="w-[200px]"
        />
      </FilterBar>

      <ActiveFilters
        filters={[
          ...(range
            ? [
                {
                  id: "range",
                  label: rangeLabel(range),
                  emphasized: true,
                  onClear: () => resetPage(setRange)(null),
                },
              ]
            : []),
          ...(category
            ? [
                {
                  id: "category",
                  label: EXPENSE_CATEGORY_LABEL[category],
                  onClear: () => resetPage(setCategory)(null),
                },
              ]
            : []),
        ]}
      />

      {summary.data && <ExpenseSummaryStrip summary={summary.data} />}

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={62} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={Banknote}
            title="Xarajat topilmadi"
            message="Tanlangan filtr bo'yicha xarajat yo'q."
          />
        ) : (
          <>
            <ul
              style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}
              aria-busy={list.isPlaceholderData}
            >
              {list.data.results.map((expense, index) => (
                <li
                  key={expense.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <ExpenseRow
                    expense={expense}
                    onEdit={() => {
                      setEditing(expense);
                      setFormOpen(true);
                    }}
                    onDelete={() => setDeleting(expense)}
                  />
                </li>
              ))}
            </ul>
            <PaginationBar
              page={page}
              pageSize={PAGE_SIZE}
              total={list.data.count}
              onPageChange={setPage}
              busy={list.isFetching}
            />
          </>
        )}
      </AppCard>

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editing} />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xarajat o&rsquo;chirilsinmi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                <>
                  {money.uzs(deleting.amount)} — {expenseCategoryLabel(deleting)}. Bu
                  amalni qaytarib bo&rsquo;lmaydi.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-danger-foreground"
              onClick={() => {
                if (deleting) remove.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              O&rsquo;chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}

function ExpenseRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="w-20 shrink-0">
        <p className="text-title-sm tabular">{dayMonth(expense.expenseDate)}</p>
        <p className="text-caption text-text-tertiary tabular">
          {shortDate(expense.expenseDate)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="bg-surface-alt text-label-xs text-text-secondary rounded-full px-2 py-0.5">
            {expenseCategoryLabel(expense)}
          </span>
          <span
            className={cn(
              "text-label-xs rounded-full px-2 py-0.5",
              expense.paymentType
                ? "bg-primary-soft text-primary-dark"
                : "bg-warning/15 text-warning",
            )}
          >
            {expensePaymentLabel(expense)}
          </span>
        </div>
        {expense.note !== "" && (
          <p className="text-caption text-text-secondary mt-1 truncate">{expense.note}</p>
        )}
      </div>

      <p className="text-title tabular text-danger shrink-0">
        −{money.plain(expense.amount)}
      </p>

      <div className="flex w-[76px] shrink-0 justify-end gap-1">
        {/* The backend locks a record the day after it was entered, so these
            only appear while it can actually be changed. */}
        {expense.canEdit && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              aria-label="Tahrirlash"
              className="text-text-secondary"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              aria-label="O'chirish"
              className="text-text-secondary hover:text-danger"
            >
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
