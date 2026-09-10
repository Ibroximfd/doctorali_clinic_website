import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CircleMinus,
  Package,
  UserX,
  CalendarCheck,
  type LucideIcon,
} from "lucide-react";

import { AppRoutes } from "@/config/routes";

/**
 * What kind of thing is asking for reception's attention (`GET alerts/`).
 *
 * `unknown` absorbs any alert type a newer backend introduces — an unfamiliar
 * signal should still be SHOWN, since the server already wrote the sentence; it
 * simply won't be clickable.
 */
export type ReceptionAlertKind =
  | "debt_overdue"
  | "debt_due_today"
  | "visit_today"
  | "visit_no_show"
  | "low_stock"
  | "out_of_stock"
  | "unknown";

const KNOWN_KINDS: readonly ReceptionAlertKind[] = [
  "debt_overdue",
  "debt_due_today",
  "visit_today",
  "visit_no_show",
  "low_stock",
  "out_of_stock",
];

export function parseAlertKind(raw: unknown): ReceptionAlertKind {
  return KNOWN_KINDS.includes(raw as ReceptionAlertKind)
    ? (raw as ReceptionAlertKind)
    : "unknown";
}

export const ALERT_ICON: Readonly<Record<ReceptionAlertKind, LucideIcon>> = {
  debt_overdue: AlertTriangle,
  debt_due_today: CalendarClock,
  visit_today: CalendarCheck,
  visit_no_show: UserX,
  low_stock: Package,
  out_of_stock: CircleMinus,
  unknown: Bell,
};

/** Where tapping the alert takes reception. Null means it isn't actionable. */
export function alertTarget(kind: ReceptionAlertKind): string | null {
  switch (kind) {
    case "debt_overdue":
    case "debt_due_today":
      return AppRoutes.debts;
    case "visit_today":
    case "visit_no_show":
      return AppRoutes.appointments;
    // Straight to the shelves that need attention, filter already applied.
    case "low_stock":
    case "out_of_stock":
      return `${AppRoutes.warehouse}?filter=low`;
    case "unknown":
      return null;
  }
}

/** How loudly to render it. */
export function isCriticalAlert(kind: ReceptionAlertKind): boolean {
  return kind === "debt_overdue" || kind === "out_of_stock";
}

/**
 * One line of the "today's signals" card.
 *
 * `title` arrives as finished Uzbek text from the server, exactly as with the
 * client timeline — the app supplies the icon, the colour and the destination.
 */
export interface ReceptionAlert {
  readonly kind: ReceptionAlertKind;
  readonly title: string;
  readonly count: number;
  readonly amount: number;
}

export function parseReceptionAlerts(raw: unknown): ReceptionAlert[] {
  if (!Array.isArray(raw)) return [];
  const out: ReceptionAlert[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const a = item as Record<string, unknown>;
    const title = a.title === null || a.title === undefined ? "" : String(a.title);
    // An alert with no text says nothing useful; drop it rather than render an
    // empty row.
    if (title === "") continue;
    out.push({
      kind: parseAlertKind(a.kind),
      title,
      count: typeof a.count === "number" ? a.count : 0,
      amount: typeof a.amount === "number" ? a.amount : 0,
    });
  }
  return out;
}
