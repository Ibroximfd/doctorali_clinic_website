"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { navEntryFor } from "@/config/routes";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { TopBar } from "@/shared/components/layout/top-bar";
import { Sheet, SheetContent, SheetTitle } from "@/shared/components/ui/sheet";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { useResetOnChange } from "@/shared/hooks/use-reset-on-change";

/**
 * The frame every authenticated page renders inside.
 *
 * Desktop: a persistent sidebar beside a column of top bar + scrolling content.
 * Mobile: the same sidebar in a drawer, opened from the top bar's burger.
 *
 * The page itself never scrolls — only the content region does — so the top bar
 * and the sidebar stay put while a long table moves under them.
 */
export function AppShell({
  children,
  /** Per-page action rendered on the trailing edge of the top bar. */
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const entry = navEntryFor(pathname);
  const isMobile = useMediaQuery("(max-width: 39.98rem)");

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A jump closes the drawer; leaving it open over the new page is disorienting.
  useResetOnChange(pathname, () => setDrawerOpen(false));

  return (
    <div className="bg-background flex h-dvh overflow-hidden">
      {!isMobile && (
        <Sidebar
          activePath={entry.path}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
        />
      )}

      {isMobile && (
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="w-sidebar p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Asosiy navigatsiya</SheetTitle>
            <Sidebar
              activePath={entry.path}
              collapsed={false}
              showToggle={false}
              onNavigate={() => setDrawerOpen(false)}
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={entry.label}
          subtitle={entry.subtitle}
          onMenuClick={isMobile ? () => setDrawerOpen(true) : undefined}
          actions={actions}
        />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
