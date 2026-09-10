import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * The "nothing here" placeholder.
 *
 * Every list in this panel has one. An empty table with no explanation reads as
 * a broken screen at the desk, and reception then re-runs the filter wondering
 * whether the data is missing or the app is.
 */
export function EmptyState({
  title,
  message,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  message?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span
        className="bg-surface-alt flex size-[72px] items-center justify-center rounded-full"
        aria-hidden
      >
        <Icon className="text-text-tertiary size-8" />
      </span>
      <p className="text-title mt-4">{title}</p>
      {message && (
        <p className="text-caption text-text-secondary mt-1 max-w-sm">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
