import type { ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

/**
 * The padding and max width every page's content sits in.
 *
 * Capped at 1360px so a 27" monitor does not stretch a table into unreadably
 * long rows, but the cap is generous — this is a dense tool, not an article.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-content mx-auto w-full p-5", className)}>{children}</div>
  );
}
