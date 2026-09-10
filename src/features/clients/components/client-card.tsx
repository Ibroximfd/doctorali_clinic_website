"use client";

import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { lastVisitLabel, recordName, type ClientRecord } from "../types/client-record";
import { ClientAvatarName } from "./client-avatar-name";
import { ClientDebtPill } from "./client-debt-pill";
import { ClientRowActions, type ClientRowAction } from "./client-row-actions";
import { ClientTagChip } from "./client-tag-chip";

/**
 * Narrow-screen form of a client row: identity on top, then the three figures
 * reception scans for, then the tags.
 */
export function ClientCard({
  client,
  onOpen,
  onAction,
}: {
  client: ClientRecord;
  onOpen: () => void;
  onAction: (action: ClientRowAction) => void;
}) {
  const metrics: readonly { label: string; value: string }[] = [
    { label: "Tashrif", value: String(client.visitsCount) },
    { label: "Xarid", value: money.compact(client.ordersTotal) },
    { label: "Oxirgi", value: lastVisitLabel(client) },
  ];

  return (
    <div className={cn("p-4", client.overdueDebt > 0 && "bg-danger/5")}>
      <div className="flex items-start gap-2">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="focus-visible:ring-ring min-w-0 flex-1 cursor-pointer rounded-sm text-left focus-visible:ring-2 focus-visible:outline-none"
        >
          <ClientAvatarName
            name={recordName(client)}
            phone={client.phone}
            avatarUrl={client.avatarUrl}
            isAppUser={client.isAppUser}
            isBlocked={client.isBlocked}
            size={38}
          />
        </div>
        <ClientRowActions client={client} onSelect={onAction} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="text-label-xs text-text-tertiary">{metric.label}</p>
            <p className="text-title-sm tabular">{metric.value}</p>
          </div>
        ))}
      </div>

      {(client.openDebt > 0 || client.tags.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ClientDebtPill openDebt={client.openDebt} overdueDebt={client.overdueDebt} />
          {client.tags.slice(0, 4).map((tag) => (
            <ClientTagChip key={tag.code} tag={tag} />
          ))}
        </div>
      )}
    </div>
  );
}
