"use client";

import { BellRing, ChevronRight } from "lucide-react";
import Link from "next/link";

import { AppCard } from "@/shared/components/data-display/app-card";
import { money } from "@/shared/lib/format/money";
import { cn } from "@/shared/lib/utils";

import { useAlertsQuery } from "../hooks/use-alerts";
import {
  ALERT_ICON,
  alertTarget,
  isCriticalAlert,
  type ReceptionAlert,
} from "../types/reception-alert";

/**
 * "Bugungi eslatmalar" — what needs reception's attention right now.
 *
 * Every row is a shortcut into the page that can act on it: an overdue debt
 * leads to the debts list, a low shelf to the warehouse. A signal reception can
 * read but not act on would just be noise.
 *
 * Renders nothing at all when there is nothing to report, so a clean morning
 * leaves the dashboard clean.
 */
export function AlertsCard() {
  const { data: alerts = [], isPending } = useAlertsQuery();

  if (isPending || alerts.length === 0) return null;

  return (
    <AppCard padded={false} className="p-4">
      <h2 className="text-title-sm mb-3 flex items-center gap-2">
        <BellRing className="text-warning size-[18px]" aria-hidden />
        Bugungi eslatmalar
      </h2>
      <ul>
        {alerts.map((alert) => (
          <AlertRow key={`${alert.kind}:${alert.title}`} alert={alert} />
        ))}
      </ul>
    </AppCard>
  );
}

function AlertRow({ alert }: { alert: ReceptionAlert }) {
  const Icon = ALERT_ICON[alert.kind];
  const critical = isCriticalAlert(alert.kind);
  const href = alertTarget(alert.kind);

  const body = (
    <>
      <Icon
        className={cn("size-4 shrink-0", critical ? "text-danger" : "text-warning")}
        aria-hidden
      />
      <span className="text-caption text-text-primary min-w-0 flex-1">{alert.title}</span>
      {alert.amount > 0 ? (
        <span
          className={cn(
            "text-label-sm tabular shrink-0",
            critical ? "text-danger" : "text-warning",
          )}
        >
          {money.plain(alert.amount)}
        </span>
      ) : alert.count > 0 ? (
        <span
          className={cn(
            "text-label-sm shrink-0",
            critical ? "text-danger" : "text-warning",
          )}
        >
          {alert.count} ta
        </span>
      ) : null}
      {href && (
        <ChevronRight className="text-text-tertiary size-4 shrink-0" aria-hidden />
      )}
    </>
  );

  const rowClass =
    "flex items-center gap-2 rounded-sm px-1 py-2 min-h-11 transition-colors";

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={cn(
            rowClass,
            "hover:bg-surface-alt focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}
