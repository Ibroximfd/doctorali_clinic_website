"use client";

import { Building2, CalendarDays, Menu } from "lucide-react";
import type { ReactNode } from "react";

import { useAuthStore } from "@/features/auth/store/auth-store";
import { dayMonthYear, nowTashkent } from "@/shared/lib/format/date";
import { Button } from "@/shared/components/ui/button";

/**
 * Page title, today's date and the page's primary action.
 *
 * The date chip is not decoration: everything in this panel is filed against a
 * Tashkent calendar day, and a desk working past midnight needs to see which
 * day the server will file the next sale under.
 */
export function TopBar({
  title,
  subtitle,
  onMenuClick,
  actions,
}: {
  title: string;
  subtitle?: string;
  /** Present only on mobile, where the sidebar is a drawer. */
  onMenuClick?: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="h-topbar border-border bg-background flex shrink-0 items-center gap-3 border-b px-5">
      {onMenuClick && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2"
          onClick={onMenuClick}
          aria-label="Menyu"
        >
          <Menu className="size-[22px]" />
        </Button>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="text-title-lg truncate">{title}</h1>
        {subtitle && (
          <p className="text-caption text-text-secondary hidden truncate md:block">
            {subtitle}
          </p>
        )}
      </div>

      <FilialChip />
      <TodayChip />
      {actions}
    </header>
  );
}

/** `9 sentabr 2026` — rendered client-side so it always shows Tashkent's day. */
function TodayChip() {
  return (
    <span className="border-border bg-surface hidden items-center gap-2 rounded-md border px-3 py-2 md:inline-flex">
      <CalendarDays className="text-primary size-[15px]" aria-hidden />
      <span className="text-label-sm tabular">{dayMonthYear(nowTashkent())}</span>
    </span>
  );
}

/**
 * The branch this desk works in. Every list and figure on screen is already
 * scoped to it, so naming it is what tells two branches' staff apart.
 */
function FilialChip() {
  const filial = useAuthStore((s) => s.user?.filial ?? null);
  if (filial === null) return null;
  return (
    <span className="border-border bg-surface hidden items-center gap-2 rounded-md border px-3 py-2 md:inline-flex">
      <Building2 className="text-primary size-[15px]" aria-hidden />
      <span className="text-label-sm">{filial.name}</span>
    </span>
  );
}
