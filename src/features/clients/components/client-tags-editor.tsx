"use client";

import { Check } from "lucide-react";

import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";

import { useClientTagsQuery } from "../hooks/use-clients";

/**
 * Picks the manual tags on a card.
 *
 * Automatic tags are not offered at all: they describe a computed fact the
 * nightly job owns, so a checkbox for one would promise an edit that gets
 * overwritten by morning.
 */
export function ClientTagsEditor({
  value,
  onChange,
}: {
  value: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const { data: tags, isPending } = useClientTagsQuery();
  const manual = (tags ?? []).filter((tag) => !tag.isAuto);

  if (isPending) {
    return (
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  if (manual.length === 0) {
    return (
      <p className="text-caption text-text-tertiary">
        Teg yo&rsquo;q — administrator qo&rsquo;shishi kerak.
      </p>
    );
  }

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {manual.map((tag) => {
        const selected = value.includes(tag.code);
        return (
          <button
            key={tag.code}
            type="button"
            role="checkbox"
            aria-checked={selected}
            onClick={() => toggle(tag.code)}
            className={cn(
              "text-label-sm inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              selected
                ? "border-primary bg-primary-soft text-primary-dark"
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {selected && <Check className="size-3" aria-hidden />}
            {tag.name}
          </button>
        );
      })}
    </div>
  );
}
