import type { ReactNode } from "react";

import { AuthGate } from "@/features/auth/components/auth-gate";
import { AppShell } from "@/shared/components/layout/app-shell";
import { QueryProvider } from "@/shared/components/providers/query-provider";
import { TooltipProvider } from "@/shared/components/ui/tooltip";

/**
 * Every page in this group is behind the session gate and inside the shell.
 * There are no public pages in this panel beyond `/login`.
 *
 * The query cache lives here rather than in the root layout: `/login` fetches
 * nothing, and making it download React Query to show two fields is what put a
 * second onto the first paint of the one screen every shift starts with.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider delayDuration={250}>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </TooltipProvider>
    </QueryProvider>
  );
}
