"use client";

import { Check, ChevronDown, Stethoscope } from "lucide-react";
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
import { cn } from "@/shared/lib/utils";

import { useDoctorsQuery } from "../hooks/use-doctors";

/**
 * "Whose sales are these?" — the doctor filter every money list needs.
 *
 * A searchable list rather than a plain `<select>`: a clinic with thirty
 * doctors turns a native dropdown into a scroll hunt, and the desk knows the
 * name it is looking for.
 */
export function DoctorFilter({
  value,
  onChange,
  allLabel = "Barcha shifokorlar",
  className,
}: {
  /** Doctor id, or null for every doctor. */
  value: string | null;
  onChange: (doctorId: string | null) => void;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isPending } = useDoctorsQuery(debouncedSearch);

  const selected = data?.results.find((doctor) => doctor.id === value) ?? null;

  function pick(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Shifokor bo'yicha filtr"
          className={cn(
            "h-[38px] w-[200px] justify-start gap-2 px-3 font-normal",
            value !== null &&
              "border-primary/35 bg-primary-soft/60 text-primary-dark hover:bg-primary-soft",
            className,
          )}
        >
          <Stethoscope className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? selected.fullName : value ? "Shifokor" : allLabel}
          </span>
          <ChevronDown className="text-text-tertiary size-3.5 shrink-0" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[280px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Shifokor ismi…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isPending ? (
              <CommandEmpty>Yuklanmoqda…</CommandEmpty>
            ) : (
              <CommandEmpty>Shifokor topilmadi</CommandEmpty>
            )}
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => pick(null)}>
                <span className="flex-1">{allLabel}</span>
                {value === null && <Check className="text-primary size-4" aria-hidden />}
              </CommandItem>
              {data?.results.map((doctor) => (
                <CommandItem
                  key={doctor.id}
                  value={doctor.id}
                  onSelect={() => pick(doctor.id)}
                >
                  <AppAvatar
                    name={doctor.fullName}
                    imageUrl={doctor.avatarUrl}
                    size={24}
                  />
                  <span className="min-w-0 flex-1 truncate">{doctor.fullName}</span>
                  {value === doctor.id && (
                    <Check className="text-primary size-4" aria-hidden />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
