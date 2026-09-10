"use client";

import { Pencil, Plus, UserRoundX, Users } from "lucide-react";
import { useState } from "react";

import { AppCard } from "@/shared/components/data-display/app-card";
import { ListSkeleton } from "@/shared/components/data-display/list-skeleton";
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
import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PhoneInput } from "@/shared/components/form/phone-input";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { phoneFromApi, phoneToApi } from "@/shared/lib/format/phone";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";
import { cn } from "@/shared/lib/utils";

import {
  EMPLOYEE_ACTIVE_LABEL,
  EMPLOYEE_ORDERINGS,
  type EmployeeActiveFilter,
} from "../api/attendance-api";
import {
  useCreateEmployee,
  useDeactivateEmployee,
  useEmployeesQuery,
  useUpdateEmployee,
} from "../hooks/use-attendance";
import { employeePhonePretty, type Employee } from "../types/attendance";

const PAGE_SIZE = 20;

/** "Xodimlar" — the roster reception keeps for the roll-call. */
export function EmployeesView() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<EmployeeActiveFilter>("active");
  const [ordering, setOrdering] = useState<string>("full_name");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<Employee | null>(null);

  const debouncedSearch = useDebouncedValue(search);
  const list = useEmployeesQuery({
    search: debouncedSearch,
    active,
    ordering,
    page,
  });
  const deactivate = useDeactivateEmployee();

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={reset(setSearch)}
          placeholder="Ism yoki lavozim…"
          className="w-full sm:w-[260px]"
        />
        <Select
          value={active}
          onValueChange={reset((value: string) =>
            setActive(value as EmployeeActiveFilter),
          )}
        >
          <SelectTrigger className="w-[150px]" aria-label="Holat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EMPLOYEE_ACTIVE_LABEL) as EmployeeActiveFilter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {EMPLOYEE_ACTIVE_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ordering} onValueChange={reset(setOrdering)}>
          <SelectTrigger className="w-[190px]" aria-label="Saralash">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EMPLOYEE_ORDERINGS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" aria-hidden />
          Xodim qo&rsquo;shish
        </Button>
      </div>

      <AppCard padded={false} className="overflow-hidden">
        {list.error && !list.data ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : list.isPending || !list.data ? (
          <ListSkeleton rows={8} height={62} />
        ) : list.data.results.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Xodim topilmadi"
            message="Qidiruvni tozalang."
          />
        ) : (
          <>
            <ul>
              {list.data.results.map((employee, index) => (
                <li
                  key={employee.id}
                  className={index > 0 ? "border-surface-alt border-t" : undefined}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-3",
                      !employee.isActive && "opacity-60",
                    )}
                  >
                    <AppAvatar name={employee.fullName} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-title-sm truncate">
                          {employee.fullName}
                        </span>
                        {!employee.isActive && (
                          <span className="bg-surface-alt text-label-xs text-text-tertiary shrink-0 rounded-full px-2 py-0.5">
                            Nofaol
                          </span>
                        )}
                      </div>
                      <p className="text-caption text-text-tertiary tabular truncate">
                        {employee.position || "Lavozim ko'rsatilmagan"}
                        {employee.phone && ` · ${employeePhonePretty(employee)}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(employee);
                        setFormOpen(true);
                      }}
                      aria-label="Tahrirlash"
                      className="text-text-secondary"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {employee.isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeactivating(employee)}
                        aria-label="Ro'yxatdan chiqarish"
                        className="text-text-secondary hover:text-danger"
                      >
                        <UserRoundX className="size-4" />
                      </Button>
                    )}
                  </div>
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

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} />

      <AlertDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ro&rsquo;yxatdan chiqarilsinmi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivating?.fullName} kunlik yo&rsquo;qlamadan yo&rsquo;qoladi, lekin
              eski statistikada qoladi — yozuvlari o&rsquo;chirilmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivating) deactivate.mutate(deactivating.id);
                setDeactivating(null);
              }}
            >
              Chiqarish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}) {
  const create = useCreateEmployee();
  const update = useUpdateEmployee();

  const [fullName, setFullName] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  useResetOnChange(open ? (employee?.id ?? "new") : null, () => {
    if (!open) return;
    setFullName(employee?.fullName ?? "");
    setPosition(employee?.position ?? "");
    setPhone(employee?.phone ? phoneFromApi(employee.phone) : "");
    setNote(employee?.note ?? "");
    setTouched(false);
  });

  const nameError = touched && fullName.trim() === "" ? "F.I.O. kiriting" : null;
  const busy = create.isPending || update.isPending;

  async function submit() {
    setTouched(true);
    if (fullName.trim() === "") return;
    // A phone is optional: a desk that knows a name should be able to add the
    // person without hunting for a number.
    const payload = {
      fullName,
      position,
      phone: phone.trim() === "" ? "" : phoneToApi(phone),
      note,
    };
    if (employee) await update.mutateAsync({ id: employee.id, patch: payload });
    else await create.mutateAsync(payload);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{employee ? "Xodimni tahrirlash" : "Yangi xodim"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">F.I.O.</Label>
            <Input
              id="emp-name"
              autoFocus
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(nameError)}
              className="h-[46px]"
            />
            {nameError && (
              <p role="alert" className="text-caption text-danger">
                {nameError}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emp-position">Lavozim</Label>
              <Input
                id="emp-position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Sotuvchi"
                className="h-[46px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-phone">Telefon</Label>
              <PhoneInput
                id="emp-phone"
                value={phone}
                onValueChange={setPhone}
                className="h-[46px]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-note">Izoh</Label>
            <Input
              id="emp-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="h-[46px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={busy}>
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
