"use client";

import { ChevronLeft } from "lucide-react";

import { NAV_SECTIONS } from "@/config/routes";
import { BrandMark } from "@/shared/components/layout/brand-mark";
import { navIcon } from "@/shared/components/layout/nav-icon";
import { SidebarItem } from "@/shared/components/layout/sidebar-item";
import { SidebarUserFooter } from "@/shared/components/layout/sidebar-user-footer";
import { cn } from "@/shared/lib/utils";

/**
 * The persistent left navigation.
 *
 * On desktop it animates between 248px and 76px; on mobile the same component
 * renders inside a drawer, always expanded and with no collapse control.
 */
export function Sidebar({
  activePath,
  collapsed,
  onToggleCollapse,
  onNavigate,
  showToggle = true,
}: {
  activePath: string;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  /** Closes the mobile drawer after a jump. */
  onNavigate?: () => void;
  showToggle?: boolean;
}) {
  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className={cn(
        "border-sidebar-border bg-sidebar flex h-full flex-col border-r",
        "transition-[width] duration-240 ease-in-out",
        collapsed ? "w-sidebar-mini" : "w-sidebar",
      )}
    >
      <div className="flex items-center gap-3 px-4 pt-5 pb-4">
        <BrandMark size={40} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-title truncate">Doctor Ali</p>
            <p className="text-caption text-text-tertiary truncate">Qabulxona</p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {collapsed ? (
              <div className="bg-border mx-3 my-3 h-px" role="separator" />
            ) : (
              <p className="text-text-tertiary px-3 pt-4 pb-2 text-[10.5px] font-semibold tracking-[1.1px] uppercase">
                {section.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {section.entries.map((entry) => (
                <li key={entry.path}>
                  <SidebarItem
                    href={entry.path}
                    label={entry.label}
                    icon={navIcon(entry.icon)}
                    active={activePath === entry.path}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="pt-2 pb-2">
        <SidebarUserFooter collapsed={collapsed} />
      </div>

      {showToggle && (
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Menyuni yoyish" : "Menyuni yig'ish"}
            className={cn(
              "flex h-10 w-full items-center justify-center gap-1 rounded-md",
              "border-border bg-surface-alt text-label-sm text-text-secondary border",
              "hover:bg-surface-hover transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            <ChevronLeft
              className={cn(
                "size-5 transition-transform duration-240",
                collapsed && "rotate-180",
              )}
              aria-hidden
            />
            {!collapsed && <span>Yig&rsquo;ish</span>}
          </button>
        </div>
      )}
    </nav>
  );
}
