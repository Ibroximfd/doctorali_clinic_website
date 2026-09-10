"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

/**
 * One navigation entry. The modern nav idiom rather than a heavy filled block:
 * a soft tinted pill with a small accent dot, so the page content stays the
 * loudest thing on screen.
 *
 * Collapsed, it becomes an icon-only pill with the label in a tooltip.
 */
export function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  collapsed: boolean;
  /** A count worth interrupting for — overdue debts, for instance. */
  badge?: number;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-[42px] items-center gap-3 rounded-sm px-3",
        "text-sm font-semibold transition-colors duration-150 outline-none",
        "focus-visible:ring-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-1",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary-soft text-primary-dark font-bold"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      <Icon className="size-[19px] shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="bg-danger text-danger-foreground tabular rounded-full px-[7px] py-px text-[11px] font-bold">
              {badge}
            </span>
          )}
          {active && badge === undefined && (
            <span className="bg-primary size-[5px] shrink-0 rounded-full" aria-hidden />
          )}
        </>
      )}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
