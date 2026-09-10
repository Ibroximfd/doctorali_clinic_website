"use client";

import { Check, ChevronsUpDown, Stethoscope, X } from "lucide-react";
import { useState } from "react";

import type { DoctorRef } from "@/features/doctors/types/doctor";
import { useDoctorsQuery } from "@/features/doctors/hooks/use-doctors";
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
import { cn } from "@/shared/lib/utils";

/**
 * Optional doctor for a visit.
 *
 * Deliberately not the New Order picker: commission percentages belong to a
 * sale, and printing them next to a name here would only invite reception to
 * pick the cheapest doctor for a consultation.
 */
export function DoctorRefPicker({
  value,
  onChange,
  onClear,
  id,
  disabled,
  placeholder = "Shifokor (ixtiyoriy)",
}: {
  value: DoctorRef | null;
  onChange: (doctor: DoctorRef) => void;
  onClear: () => void;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isPending } = useDoctorsQuery(debouncedSearch);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-[46px] w-full justify-between gap-2 px-3",
            value === null && "text-text-tertiary font-normal",
          )}
        >
          {value ? (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <AppAvatar name={value.fullName} imageUrl={value.avatarUrl} size={26} />
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate font-semibold">{value.fullName}</span>
                {value.specialty !== "" && (
                  <span className="text-label-xs text-text-tertiary block truncate font-normal">
                    {value.specialty}
                  </span>
                )}
              </span>
            </span>
          ) : (
            <span className="flex flex-1 items-center gap-2 text-left">
              <Stethoscope className="text-text-tertiary size-4 shrink-0" aria-hidden />
              {placeholder}
            </span>
          )}
          {value ? (
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
            <ChevronsUpDown className="text-text-tertiary size-4 shrink-0" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Ism yoki mutaxassislik…"
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
                        onChange({
                          id: doctor.id,
                          fullName: doctor.fullName,
                          specialty: doctor.specialty,
                          avatarUrl: doctor.avatarUrl,
                        });
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
  );
}
