"use client";

import {
  CalendarPlus,
  MoreHorizontal,
  Pencil,
  Phone,
  ShoppingCart,
  StickyNote,
  Stethoscope,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

import type { ClientRecord } from "../types/client-record";

/** What reception can start from a client row without leaving the list. */
export type ClientRowAction =
  "newVisit" | "newOrder" | "newTreatment" | "call" | "edit" | "addNote";

const ACTION: Readonly<Record<ClientRowAction, { label: string; icon: LucideIcon }>> = {
  newVisit: { label: "Yangi tashrif", icon: CalendarPlus },
  newOrder: { label: "Yangi buyurtma", icon: ShoppingCart },
  newTreatment: { label: "Muolaja", icon: Stethoscope },
  call: { label: "Qo'ng'iroq", icon: Phone },
  edit: { label: "Tahrirlash", icon: Pencil },
  addNote: { label: "Izoh qo'shish", icon: StickyNote },
};

/**
 * The "⋯" menu on a client row.
 *
 * A blocked client can still be contacted and edited, but not sold to — the
 * selling actions are removed rather than disabled, because a forbidden action
 * should simply not be offered.
 */
export function ClientRowActions({
  client,
  onSelect,
}: {
  client: ClientRecord;
  onSelect: (action: ClientRowAction) => void;
}) {
  const actions: ClientRowAction[] = [
    ...(client.isBlocked
      ? []
      : (["newVisit", "newOrder", "newTreatment"] as ClientRowAction[])),
    "call",
    "edit",
    "addNote",
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Amallar"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="text-text-tertiary size-4" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        {actions.map((action) => {
          const { label, icon: Icon } = ACTION[action];
          return (
            <DropdownMenuItem key={action} onSelect={() => onSelect(action)}>
              <Icon className="size-4" aria-hidden />
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
