"use client";

import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { ApiError } from "@/shared/lib/api/errors";

/**
 * Global React Query behaviour for a reception desk.
 *
 * The tuning here is deliberate rather than default:
 *  • `staleTime` 30s — the desk revisits the same list many times in a shift;
 *    a fresh fetch on every navigation made the Flutter panel feel slow.
 *  • `refetchOnWindowFocus` — ON, because the panel sits open all day while
 *    money changes underneath it; coming back to the tab should show today's
 *    figures, not this morning's.
 *  • Retries skip client errors: a 400/401/403/404 will not become a 200 by
 *    asking again, and retrying a refused write just delays the message.
 *  • Mutations never retry automatically — idempotency keys make a *deliberate*
 *    retry safe, but an automatic one could double a debt repayment.
 */
const config: QueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry(failureCount, error) {
        if (ApiError.is(error)) {
          if (error.isNetwork) return failureCount < 2;
          const status = error.status ?? 0;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 1;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8_000),
    },
    mutations: {
      retry: false,
    },
  },
};

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session, created inside the component so a Fast
  // Refresh (or a second render in StrictMode) never discards the cache.
  const [client] = useState(() => new QueryClient(config));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
