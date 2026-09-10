"use client";

import {
  Ban,
  CalendarPlus,
  LockOpen,
  Pencil,
  Phone,
  ShoppingCart,
  StickyNote,
  Stethoscope,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { selectPermissions, useAuthStore } from "@/features/auth/store/auth-store";
import { Button } from "@/shared/components/ui/button";

import type { ClientRecord } from "../types/client-record";
import { useClientActions } from "./client-actions-provider";

type ProfileAction =
  | "newVisit"
  | "newOrder"
  | "newTreatment"
  | "call"
  | "addNote"
  | "edit"
  | "block"
  | "unblock"
  | "anonymize";

const ACTION: Readonly<
  Record<ProfileAction, { label: string; icon: LucideIcon; destructive?: boolean }>
> = {
  newVisit: { label: "Tashrif", icon: CalendarPlus },
  newOrder: { label: "Buyurtma", icon: ShoppingCart },
  newTreatment: { label: "Muolaja", icon: Stethoscope },
  call: { label: "Qo'ng'iroq", icon: Phone },
  addNote: { label: "Izoh", icon: StickyNote },
  edit: { label: "Tahrir", icon: Pencil },
  block: { label: "Bloklash", icon: Ban, destructive: true },
  unblock: { label: "Blokdan chiqarish", icon: LockOpen },
  anonymize: { label: "Unutish", icon: UserX, destructive: true },
};

/**
 * The action row of the 360° card — the whole point of the "one window" rule: a
 * visit, an order or a treatment starts here, without leaving the client.
 *
 * A blocked client keeps the contact and admin actions but loses the selling
 * ones: the backend refuses those sales, so offering them would only produce a
 * confusing error after the work of filling in a form. The admin actions appear
 * solely when `auth/me/` grants them — a forbidden action is hidden, never
 * disabled.
 */
export function ClientProfileActions({ client }: { client: ClientRecord }) {
  const actions = useClientActions();
  const permissions = useAuthStore(selectPermissions);

  const available: ProfileAction[] = [
    ...(client.isBlocked
      ? []
      : (["newVisit", "newOrder", "newTreatment"] as ProfileAction[])),
    "call",
    "addNote",
    "edit",
    ...(permissions.canBlockClients
      ? [client.isBlocked ? ("unblock" as const) : ("block" as const)]
      : []),
    ...(permissions.canAnonymize ? (["anonymize"] as ProfileAction[]) : []),
  ];

  function run(action: ProfileAction) {
    switch (action) {
      case "block":
        actions.block(client);
        return;
      case "unblock":
        actions.unblock(client);
        return;
      case "anonymize":
        actions.anonymize(client);
        return;
      default:
        actions.run(client, action);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((action) => {
        const { label, icon: Icon, destructive } = ACTION[action];
        return (
          <Button
            key={action}
            type="button"
            size="lg"
            variant={destructive ? "destructive" : "outline"}
            onClick={() => run(action)}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Button>
        );
      })}
    </div>
  );
}
