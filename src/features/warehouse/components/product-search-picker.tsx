"use client";

import { Package, Plus } from "lucide-react";
import { useState } from "react";

import { useProductsInfiniteQuery } from "@/features/products/hooks/use-products";
import { formatProductUnits, type Product } from "@/features/products/types/product";
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

/**
 * Adds a product to a warehouse document.
 *
 * Every row prints the current balance, because the number reception is about
 * to change is the number they need to see while choosing.
 */
export function ProductSearchPicker({
  onSelect,
  excludeIds = [],
  label = "Mahsulot qo'shish",
}: {
  onSelect: (product: Product) => void;
  /** Products already on the document — offering them twice invites a refusal. */
  excludeIds?: readonly string[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const { data, isPending } = useProductsInfiniteQuery(debouncedSearch);

  const products = (data?.pages ?? [])
    .flatMap((page) => page.results)
    .filter((product) => !excludeIds.includes(product.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start">
          <Plus className="size-4" aria-hidden />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Mahsulot nomi…"
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
                <CommandEmpty>Mahsulot topilmadi.</CommandEmpty>
                <CommandGroup>
                  {products.slice(0, 40).map((product) => (
                    <CommandItem
                      key={product.id}
                      value={product.id}
                      onSelect={() => {
                        onSelect(product);
                        setSearch("");
                        setOpen(false);
                      }}
                      className="gap-2"
                    >
                      <AppAvatar
                        name={product.name}
                        imageUrl={product.imageUrl}
                        size={26}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-title-sm block truncate">
                          {product.name}
                        </span>
                        {product.category !== "" && (
                          <span className="text-caption text-text-tertiary block truncate">
                            {product.category}
                          </span>
                        )}
                      </span>
                      <span className="text-caption text-text-tertiary tabular shrink-0">
                        {product.trackStock
                          ? formatProductUnits(product, product.stockQuantity)
                          : "∞"}
                      </span>
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

/** The empty state a document shows before anything is on it. */
export function EmptyDocumentLines({ message }: { message: string }) {
  return (
    <p className="border-border text-caption text-text-tertiary flex flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center">
      <Package className="size-6" aria-hidden />
      {message}
    </p>
  );
}
