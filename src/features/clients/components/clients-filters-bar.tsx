"use client";

import { FilterX } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

import {
  CLIENT_ORDERINGS,
  CLIENT_ORDERING_LABEL,
  hasActiveFilters,
  type ClientFilter,
  type ClientOrdering,
} from "../api/clients-crm-api";
import { useClientTagsQuery } from "../hooks/use-clients";
import type { ClientGender } from "../types/client-record";

const ALL = "__all__";

/**
 * The refining filters under the segment chips.
 *
 * They wrap rather than shrink: on a narrow screen the dropdowns reflow onto a
 * second line instead of squeezing their text — the density rule here is
 * "change the layout, never the type size".
 */
export function ClientsFiltersBar({
  filter,
  onChange,
}: {
  filter: ClientFilter;
  onChange: (filter: ClientFilter) => void;
}) {
  const { data: tags } = useClientTagsQuery();
  const selectableTags = (tags ?? []).filter((tag) => !tag.isAuto);
  // The bar drives one tag at a time; the multi-tag capability stays available
  // to the segments, which add their own auto tag on top.
  const activeTag = filter.tags?.[0] ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectableTags.length > 0 && (
        <FilterSelect
          label="Teg"
          value={activeTag ?? ALL}
          onValueChange={(value) =>
            onChange({ ...filter, tags: value === ALL ? [] : [value] })
          }
          options={[
            { value: ALL, label: "Barcha teg" },
            ...selectableTags.map((tag) => ({
              value: tag.code,
              label: tag.name,
            })),
          ]}
        />
      )}

      <FilterSelect
        label="Qarz"
        value={boolValue(filter.hasDebt)}
        onValueChange={(value) => onChange({ ...filter, hasDebt: boolFrom(value) })}
        options={[
          { value: ALL, label: "Hammasi" },
          { value: "true", label: "Qarzdorlar" },
          { value: "false", label: "Qarzsizlar" },
        ]}
      />

      <FilterSelect
        label="Ilova"
        value={boolValue(filter.isAppUser)}
        onValueChange={(value) => onChange({ ...filter, isAppUser: boolFrom(value) })}
        options={[
          { value: ALL, label: "Hammasi" },
          { value: "true", label: "Ilovada bor" },
          { value: "false", label: "Ilovada yo'q" },
        ]}
      />

      <FilterSelect
        label="Jins"
        value={filter.gender ?? ALL}
        onValueChange={(value) =>
          onChange({
            ...filter,
            gender: value === ALL ? null : (value as ClientGender),
          })
        }
        options={[
          { value: ALL, label: "Hammasi" },
          { value: "male", label: "Erkak" },
          { value: "female", label: "Ayol" },
        ]}
      />

      <FilterSelect
        label="Saralash"
        value={filter.ordering ?? CLIENT_ORDERINGS[0]}
        onValueChange={(value) =>
          onChange({ ...filter, ordering: value as ClientOrdering })
        }
        options={CLIENT_ORDERINGS.map((ordering) => ({
          value: ordering,
          label: CLIENT_ORDERING_LABEL[ordering],
        }))}
      />

      {hasActiveFilters(filter) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              search: filter.search,
              segment: "all",
              tags: [],
              hasDebt: null,
              isAppUser: null,
              gender: null,
              source: null,
              ordering: filter.ordering,
            })
          }
        >
          <FilterX className="size-4" aria-hidden />
          Filtrni tozalash
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="border-border bg-surface flex h-[38px] items-center gap-1.5 rounded-md border pl-3">
      <span className="text-label-xs text-text-tertiary">{label}</span>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          aria-label={label}
          className="h-[36px] border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function boolValue(value: boolean | null | undefined): string {
  return value === null || value === undefined ? ALL : String(value);
}

function boolFrom(value: string): boolean | null {
  return value === ALL ? null : value === "true";
}
