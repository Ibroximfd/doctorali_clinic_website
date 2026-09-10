"use client";

import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { lastVisitLabel, recordName, type ClientRecord } from "../types/client-record";
import { ClientAvatarName } from "./client-avatar-name";
import { ClientDebtPill } from "./client-debt-pill";
import { ClientRowActions, type ClientRowAction } from "./client-row-actions";
import { ClientTagChip } from "./client-tag-chip";

/**
 * Column widths, shared by the header and the rows so a column can never drift
 * out of alignment with its heading.
 */
export const CLIENTS_GRID =
  "grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_74px_120px_110px_104px_44px] items-center gap-3 px-4";

export function ClientsTableHeader() {
  return (
    <div className={cn(CLIENTS_GRID, "border-border bg-surface-alt/40 border-b py-2.5")}>
      {(
        [
          ["Mijoz", "text-left"],
          ["Teglar", "text-left"],
          ["Tashrif", "text-right"],
          ["Xarid", "text-right"],
          ["Qarz", "text-right"],
          ["Oxirgi", "text-right"],
          ["", "text-left"],
        ] as const
      ).map(([label, align], i) => (
        <span
          key={label || i}
          className={cn("text-label-xs text-text-tertiary uppercase", align)}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * One desktop table row.
 *
 * Everything stays on a single line: a value that doesn't fit is truncated,
 * never shrunk — a reception screen read from a metre away cannot afford
 * smaller type.
 */
export function ClientTableRow({
  client,
  onOpen,
  onAction,
}: {
  client: ClientRecord;
  onOpen: () => void;
  onAction: (action: ClientRowAction) => void;
}) {
  return (
    // The whole row opens the card: reception aims at the person, not at a
    // particular word in their row.
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
      aria-label={`${recordName(client)} kartasini ochish`}
      className={cn(
        CLIENTS_GRID,
        "hover:bg-surface-hover focus-visible:ring-ring cursor-pointer py-2.5 transition-colors focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        // Overdue debt tints the whole row — the one state reception must
        // notice while scanning rather than reading.
        client.overdueDebt > 0 && "bg-danger/5",
      )}
    >
      <div className="min-w-0">
        <ClientAvatarName
          name={recordName(client)}
          phone={client.phone}
          avatarUrl={client.avatarUrl}
          isAppUser={client.isAppUser}
          isBlocked={client.isBlocked}
        />
      </div>

      <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
        {client.tags.length === 0 ? (
          <span className="text-body-sm text-text-tertiary">—</span>
        ) : (
          client.tags.slice(0, 3).map((tag) => <ClientTagChip key={tag.code} tag={tag} />)
        )}
      </div>

      <span className="text-body-sm text-text-secondary tabular text-right">
        {client.visitsCount}
      </span>
      <span className="text-body-sm text-text-secondary tabular text-right">
        {money.plain(client.ordersTotal)}
      </span>
      <span className="flex justify-end">
        {client.openDebt > 0 ? (
          <ClientDebtPill
            openDebt={client.openDebt}
            overdueDebt={client.overdueDebt}
            compact
          />
        ) : (
          <span className="text-body-sm text-text-tertiary">—</span>
        )}
      </span>
      <span className="text-body-sm text-text-secondary tabular text-right">
        {lastVisitLabel(client)}
      </span>

      <ClientRowActions client={client} onSelect={onAction} />
    </div>
  );
}
