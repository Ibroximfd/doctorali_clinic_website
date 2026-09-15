"use client";

import { Gift, Search, ShieldAlert, Smartphone, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppAvatar } from "@/shared/components/ui/app-avatar";
import { Input } from "@/shared/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/components/ui/popover";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { money } from "@/shared/lib/format/money";
import { phoneFromApi } from "@/shared/lib/format/phone";
import { relativeDay } from "@/shared/lib/format/date";
import { cn } from "@/shared/lib/utils";

import { isSearchable } from "../api/clients-api";
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
 *
 * Built for the keyboard: ↑/↓ walk the rows, Enter picks the highlighted one
 * (the first, if none was walked to), Escape clears. A desk that has just typed
 * a number should not have to reach for the mouse to confirm who it is.
 */
export function ClientSearchField({
  onSelect,
  placeholder = "Ism yoki telefon raqami…",
  autoFocus,
  id,
  error,
  hint,
  emptyAction,
}: {
  onSelect: (client: ClientSearchResult) => void;
  placeholder?: string;
  autoFocus?: boolean;
  id?: string;
  error?: string | null;
  /** One line under the field saying what can be typed. */
  hint?: string;
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
  const listRef = useRef<HTMLUListElement>(null);

  // The cursor is stored WITH the query it belongs to, so a new keystroke
  // resets it during render instead of via an effect that fires a frame late.
  const [cursorState, setCursorState] = useState({ query: "", index: 0 });
  if (cursorState.query !== query) setCursorState({ query, index: 0 });
  const cursor = Math.min(cursorState.index, Math.max(0, results.length - 1));

  const showResults = open && query.trim() !== "";
  const searchable = isSearchable(query);

  // Keep the highlighted row in view while ↑/↓ walk past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>("[data-highlighted]")
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor, results]);

  function pick(client: ClientSearchResult) {
    onSelect(client);
    setQuery("");
    setOpen(false);
  }

  function createFromQuery() {
    if (!emptyAction) return;
    emptyAction.onSelect(query.trim());
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setCursorState({
        query,
        index: Math.min(cursor + 1, Math.max(0, results.length - 1)),
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursorState({ query, index: Math.max(cursor - 1, 0) });
    } else if (event.key === "Enter") {
      event.preventDefault();
      const client = results[cursor];
      if (client) pick(client);
      // Nothing matched a complete query: Enter takes the way out too.
      else if (searchable && !isFetching && emptyAction) createFromQuery();
    } else if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  }

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
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              aria-label="Mijoz qidirish"
              aria-invalid={Boolean(error)}
              aria-autocomplete="list"
              aria-expanded={showResults}
              autoComplete="off"
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
                {!searchable
                  ? "Kamida 2 ta harf yoki 3 ta raqam kiriting"
                  : "Mijoz topilmadi — ism, telefon yoki raqamning bir qismini tekshiring"}
              </p>
              {emptyAction && searchable && (
                <button
                  type="button"
                  onClick={createFromQuery}
                  className="border-border text-label-sm text-primary-dark hover:bg-surface-hover focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <UserPlus className="size-4" aria-hidden />
                  {emptyAction.label}
                </button>
              )}
            </div>
          ) : (
            <>
              <ul
                ref={listRef}
                role="listbox"
                aria-label="Topilgan mijozlar"
                className="max-h-[360px] overflow-y-auto"
              >
                {results.map((client, index) => (
                  <li key={`${client.id}:${client.phone}`} role="presentation">
                    <ClientRow
                      client={client}
                      highlighted={index === cursor}
                      onSelect={() => pick(client)}
                    />
                  </li>
                ))}
              </ul>
              <p className="text-caption text-text-tertiary border-border flex items-center justify-between border-t px-2 pt-1.5 pb-0.5">
                <span>
                  {results.length} ta topildi
                  {isFetching && " · yangilanmoqda…"}
                </span>
                <span>
                  <kbd className="bg-surface-alt rounded px-1">↑↓</kbd>{" "}
                  <kbd className="bg-surface-alt rounded px-1">Enter</kbd>
                </span>
              </p>
            </>
          )}
        </PopoverContent>
      </Popover>

      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-caption text-text-tertiary">{hint}</p>
      )}
    </div>
  );
}

function ClientRow({
  client,
  highlighted,
  onSelect,
}: {
  client: ClientSearchResult;
  highlighted: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={highlighted}
      data-highlighted={highlighted ? "" : undefined}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors",
        "hover:bg-surface-hover focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        highlighted && "bg-primary-soft/60",
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
          {phoneFromApi(client.phone)}
          {client.visitsCount > 0 && ` · ${client.visitsCount} tashrif`}
          {client.ordersCount > 0 && ` · ${client.ordersCount} buyurtma`}
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
