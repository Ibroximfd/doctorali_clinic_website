"use client";

import { Gift, Search, ShieldAlert, Smartphone, X } from "lucide-react";
import { useState } from "react";

import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { relativeDay } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import { useClientSearchQuery } from "../hooks/use-client-search";
import {
  hasOpenDebt,
  searchResultName,
  type ClientSearchResult,
} from "../types/client-search";

/**
 * Finds a client by name or phone.
 *
 * Each row carries the two facts that decide what reception does next — how
 * many times this person has been in, and whether they owe money — so the
 * choice is made from the dropdown rather than after opening a card.
 */
export function ClientSearchField({
  onSelect,
  placeholder = "Ism yoki telefon raqami…",
  autoFocus,
  id,
  error,
  emptyAction,
}: {
  onSelect: (client: ClientSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  error?: string | null;
  /**
   * Offered under "Mijoz topilmadi" so a number that matches nobody still has
   * somewhere to go — there should be no path here that ends in "not found"
   * and nothing else. Receives whatever was typed.
   */
  emptyAction?: { label: string; onSelect: (query: string) => void };
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results = [], isFetching } = useClientSearchQuery(query);

  const showResults = open && query.trim() !== "";

  return (
    <div className="space-y-1.5">
      <Popover open={showResults} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Search
              className="text-text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
              aria-hidden
            />
            <Input
              id={id}
              type="search"
              value={query}
              autoFocus={autoFocus}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder}
              aria-label="Mijoz qidirish"
              aria-invalid={Boolean(error)}
              className={cn("h-[46px] pr-10 pl-11", error && "border-danger")}
            />
            {query !== "" && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Tozalash"
                className="text-text-tertiary hover:bg-surface-alt focus-visible:ring-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </PopoverAnchor>

        <PopoverContent
          align="start"
          // Keeps the caret in the input while the list is open.
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-[var(--radix-popover-trigger-width)] p-1"
        >
          {isFetching && results.length === 0 ? (
            <div className="flex flex-col gap-1 p-1" aria-hidden>
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} className="h-14 rounded-sm" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-5">
              <p className="text-caption text-text-tertiary text-center">
                {query.trim().length < 2
                  ? "Kamida 2 ta harf yoki 3 ta raqam kiriting"
                  : "Mijoz topilmadi"}
              </p>
              {emptyAction && query.trim().length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    emptyAction.onSelect(query.trim());
                    setQuery("");
                    setOpen(false);
                  }}
                  className="border-border text-label-sm text-primary-dark hover:bg-surface-hover focus-visible:ring-ring rounded-md border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {emptyAction.label}
                </button>
              )}
            </div>
          ) : (
            <ul>
              {results.map((client) => (
                <li key={client.id}>
                  <ClientRow
                    client={client}
                    onSelect={() => {
                      onSelect(client);
                      setQuery("");
                      setOpen(false);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
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

function ClientRow({
  client,
  onSelect,
}: {
  client: ClientSearchResult;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors",
        "hover:bg-surface-hover focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      <AppAvatar name={searchResultName(client)} imageUrl={client.avatarUrl} size={36} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-title-sm truncate">{searchResultName(client)}</span>
          {client.isAppUser && (
            <Smartphone className="text-info size-3.5 shrink-0" aria-label="Ilovada" />
          )}
          {client.isBlocked && (
            <ShieldAlert
              className="text-danger size-3.5 shrink-0"
              aria-label="Bloklangan"
            />
          )}
          {client.giftStatus?.giftAvailable && (
            <Gift className="text-gold size-3.5 shrink-0" aria-label="Sovg'a tayyor" />
          )}
        </span>
        <span className="text-caption text-text-tertiary tabular block truncate">
          {phoneFromApi(client.phone)} · {client.visitsCount} tashrif
          {client.lastVisitAt && ` · ${relativeDay(client.lastVisitAt)}`}
        </span>
      </span>
      {hasOpenDebt(client) && (
        <span className="bg-warning/15 text-label-xs text-warning tabular shrink-0 rounded-full px-2 py-0.5">
          {money.plain(client.openDebt)}
        </span>
      )}
    </button>
  );
}
