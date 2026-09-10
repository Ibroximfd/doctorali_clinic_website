"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { useState } from "react";

import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { useDebouncedValue } from "@/shared/hooks/use-debounced-value";
import { percent } from "@/shared/lib/format/percent";
import { cn } from "@/shared/lib/utils";

import { useDoctorsQuery } from "../hooks/use-doctors";
import type { Doctor } from "../types/doctor";

/**
 * Picks the commission-earning doctor.
 *
 * The percentage is shown on every row because it is the number the desk is
 * asked about most, and because a doctor picked by mistake is otherwise
 * invisible until the commission lands.
 */
export function DoctorPicker({
  value,
  onChange,
  onClear,
  error,
  id,
  placeholder = "Shifokorni tanlang",
  disabled,
}: {
  value: Doctor | null;
  onChange: (doctor: Doctor) => void;
  onClear?: () => void;
  error?: string | null;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isPending } = useDoctorsQuery(debouncedSearch);

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            disabled={disabled}
            className={cn(
              "h-[46px] w-full justify-between gap-2 px-3",
              value === null && "text-text-tertiary font-normal",
              error && "border-danger",
            )}
          >
            {value ? (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <AppAvatar name={value.fullName} imageUrl={value.avatarUrl} size={26} />
                <span className="truncate font-semibold">{value.fullName}</span>
                <span className="bg-primary-soft text-label-xs text-primary-dark shrink-0 rounded-full px-2 py-0.5">
                  {percent.labeled(value.commissionPercent)}
                </span>
              </span>
            ) : (
              <span className="flex-1 text-left">{placeholder}</span>
            )}
            {value && onClear ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Shifokorni olib tashlash"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.stopPropagation();
                    onClear();
                  }
                }}
                className="text-text-tertiary hover:text-text-primary rounded-full p-1"
              >
                <X className="size-3.5" />
              </span>
            ) : (
              <ChevronsUpDown
                className="text-text-tertiary size-4 shrink-0"
                aria-hidden
              />
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Shifokor qidirish…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isPending ? (
                <div className="text-caption text-text-tertiary px-3 py-6 text-center">
                  Yuklanmoqda…
                </div>
              ) : (
                <>
                  <CommandEmpty>Shifokor topilmadi.</CommandEmpty>
                  <CommandGroup>
                    {data?.results.map((doctor) => (
                      <CommandItem
                        key={doctor.id}
                        value={doctor.id}
                        onSelect={() => {
                          onChange(doctor);
                          setOpen(false);
                        }}
                        className="gap-2"
                      >
                        <AppAvatar
                          name={doctor.fullName}
                          imageUrl={doctor.avatarUrl}
                          size={28}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-title-sm block truncate">
                            {doctor.fullName}
                          </span>
                          {doctor.specialty !== "" && (
                            <span className="text-caption text-text-tertiary block truncate">
                              {doctor.specialty}
                            </span>
                          )}
                        </span>
                        <span className="text-label-sm text-primary-dark shrink-0">
                          {percent.labeled(doctor.commissionPercent)}
                        </span>
                        {value?.id === doctor.id && (
                          <Check className="text-primary size-4 shrink-0" aria-hidden />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
