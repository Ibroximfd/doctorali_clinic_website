"use client";

import { useEffect, type ReactNode } from "react";

import { useThemeStore } from "@/features/theme/store/theme-store";
import { Toaster } from "@/shared/components/ui/sonner";

/**
 * What EVERY page needs: the theme and somewhere for a toast to land.
 *
 * The server-state cache and the tooltip provider are deliberately not here —
 * they belong to the authenticated app and live in its layout, so the login
 * screen does not download the query client to render a form with two fields.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const hydrateTheme = useThemeStore((s) => s.hydrate);

  // `ThemeScript` already put the right class on <html> before paint; this
  // syncs the store so the toggle starts from the correct value.
  useEffect(() => {
    hydrateTheme();
  }, [hydrateTheme]);

  return (
    <>
      {children}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        // Money and stock messages are read, not glanced at.
        duration={5000}
      />
    </>
  );
}
